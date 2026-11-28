import { isDeepStrictEqual } from "node:util";

import type { ActionFunctionArgs } from "react-router";

import { recordAuditEntry, type AuditEntry } from "../audit-log.server";
import type { Json } from "../database.types";
import { reportUnrecordedChange } from "../server-error-report.server";
import {
  panelMemberContext,
  panelSessionContext,
  verifyAdminMember,
} from "./panel-middleware.server";

// `entidad.verbo`, en minúsculas y con guion bajo: `site_text.update`.
const ACTION_NAME = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;
const FIRST_ERROR_STATUS = 400;

export type AdminActionName = `${string}.${string}`;

/** Los campos auditados de una fila. Puede traer más: no se registran. */
export type AuditSnapshot<Field extends string> = Readonly<Record<Field, Json>>;

/** Cuál fila cambió: su uuid o, si la tabla no tiene uno, su clave. */
type AuditedEntity =
  | {
      /** Tiene que ser un uuid: la base rechaza otra cosa, y para entonces el
       * cambio ya está hecho. */
      readonly entityId: string;
      readonly entityKey?: never;
    }
  | {
      readonly entityId: null;
      /** La clave de texto o compuesta (`en`, `home.title:es`). Queda en
       * `details.key`. */
      readonly entityKey: string;
    };

/** Lo que una acción cambió. Sin `before` es una creación y sin `after`, un
 * borrado. */
export type AuditedChange<Field extends string> = AuditedEntity &
  (
    | {
        readonly before: AuditSnapshot<Field>;
        readonly after: AuditSnapshot<Field> | null;
      }
    | { readonly before: null; readonly after: AuditSnapshot<Field> }
  );

export interface AdminActionOutcome<Result, Field extends string> {
  /** Lo que responde el `action` de la ruta. */
  readonly result: Result;
  /** `null` cuando no se cambió nada: por ejemplo, un envío inválido. */
  readonly change: AuditedChange<Field> | null;
}

export interface AdminActionDefinition<
  Field extends string,
  Outcome,
  Args extends ActionFunctionArgs,
> {
  /** Como `entidad.verbo`. La entidad de la bitácora sale de aquí. */
  readonly name: AdminActionName;
  readonly auditedFields: readonly [Field, ...Field[]];
  /** Hace el cambio. Puede tipar sus argumentos con el `Route.ActionArgs` de
   * su ruta. */
  readonly run: (args: Args) => Promise<Outcome>;
}

export type AdminAction<
  Result,
  Args extends ActionFunctionArgs = ActionFunctionArgs,
> = (args: Args) => Promise<Result>;

type AuditedDetails = {
  readonly before: Record<string, Json> | null;
  readonly after: Record<string, Json> | null;
};

const definedActions = new WeakSet<object>();

/** Dice si un `action` salió de `defineAdminAction`. */
export function isAdminAction(action: unknown): boolean {
  return typeof action === "function" && definedActions.has(action);
}

function readEntity(name: string): string {
  const [entity] = name.split(".");
  if (!ACTION_NAME.test(name) || entity === undefined) {
    throw new Error(
      `La acción "${name}" no tiene la forma entidad.verbo, en minúsculas.`,
    );
  }
  return entity;
}

// Pasa por JSON para comparar exactamente lo que quedaría guardado.
function pickFields<Field extends string>(
  snapshot: AuditSnapshot<Field>,
  fields: readonly Field[],
): Record<string, Json> {
  const picked = Object.fromEntries(
    fields.map((field) => [field, snapshot[field]]),
  );
  return JSON.parse(JSON.stringify(picked)) as Record<string, Json>;
}

/** El antes y el después que van a la bitácora, solo con campos declarados.
 * `null` si ninguno de ellos cambió. */
function describeChange<Field extends string>(
  change: AuditedChange<Field>,
  auditedFields: readonly Field[],
): AuditedDetails | null {
  const before = change.before && pickFields(change.before, auditedFields);
  const after = change.after && pickFields(change.after, auditedFields);
  if (before === null || after === null) return { before, after };
  const changed = auditedFields.filter(
    (field) => !isDeepStrictEqual(before[field], after[field]),
  );
  if (changed.length === 0) return null;
  return {
    before: pickFields<string>(before, changed),
    after: pickFields<string>(after, changed),
  };
}

// Lo que se lanza para responder bien: una redirección o un `data()` sin
// estado de error.
function isSuccessfulResponse(thrown: unknown): boolean {
  if (thrown instanceof Response) return thrown.status < FIRST_ERROR_STATUS;
  if (typeof thrown !== "object" || thrown === null) return false;
  if (!("type" in thrown) || thrown.type !== "DataWithResponseInit") {
    return false;
  }
  const { init } = thrown as { init?: ResponseInit | null };
  return (init?.status ?? 200) < FIRST_ERROR_STATUS;
}

function failUnrecorded(
  message: string,
  cause: unknown,
  request: Request,
): never {
  const error = new Error(message, { cause });
  reportUnrecordedChange(error, request);
  throw error;
}

async function runChange<Args extends ActionFunctionArgs, Outcome>(
  {
    name,
    run,
  }: Pick<AdminActionDefinition<string, Outcome, Args>, "name" | "run">,
  args: Args,
): Promise<Outcome> {
  try {
    return await run(args);
  } catch (thrown) {
    if (!isSuccessfulResponse(thrown)) throw thrown;
    return failUnrecorded(
      `La acción "${name}" lanzó una respuesta de éxito y su cambio no quedaría en la bitácora: devuélvela en \`result\`.`,
      thrown,
      args.request,
    );
  }
}

async function recordChange(
  entry: AuditEntry,
  entityLabel: string,
  request: Request,
): Promise<void> {
  try {
    await recordAuditEntry(entry);
  } catch (error) {
    // Quien lea el reporte necesita saber qué quedó hecho sin su entrada.
    failUnrecorded(
      `El cambio "${entry.action}" sobre ${entry.entity} ${entityLabel} se hizo, pero no quedó en la bitácora.`,
      error,
      request,
    );
  }
}

/**
 * La única pieza por la que pasa una escritura del panel (FR-067): comprueba
 * que quien envía sea un admin activo, ejecuta `run` y deja en `audit_log`
 * quién lo hizo y qué cambió. El `action` de una ruta del panel es lo que
 * devuelve esta función.
 *
 * - NUNCA declares en `auditedFields` un secreto, un token ni el cuerpo de un
 *   mensaje de contacto: la bitácora no se puede editar ni borrar. Un campo
 *   declarado se guarda entero, con todo lo que tenga dentro.
 * - Solo se compara lo declarado: si `run` cambia algo y ningún campo
 *   declarado se mueve, no queda entrada. Declara al menos uno que cambie con
 *   cada cambio que la acción pueda hacer.
 * - `run` hace una sola escritura atómica. Si lanza, no se registra nada: con
 *   dos escrituras, la primera quedaría hecha y sin entrada.
 * - Una redirección tras un cambio va en `result`. Lanzarla es un error.
 * - Una ruta, una acción: una pantalla con varios botones envía cada verbo a
 *   su propia ruta.
 * - Si la bitácora falla, la acción lanza aunque el cambio ya esté hecho, y
 *   el fallo se reporta aunque quien envió ya haya cerrado la conexión.
 *
 * La entrada se escribe con el cliente de servicio: `audit_log` no deja
 * insertar a ninguna sesión, tampoco a la de un admin.
 */
export function defineAdminAction<
  const Field extends string,
  Outcome extends AdminActionOutcome<unknown, NoInfer<Field>>,
  Args extends ActionFunctionArgs = ActionFunctionArgs,
>(
  definition: AdminActionDefinition<Field, Outcome, Args>,
): AdminAction<Outcome["result"], Args> {
  const { name, auditedFields } = definition;
  const entity = readEntity(name);

  async function action(args: Args): Promise<Outcome["result"]> {
    const { client } = args.context.get(panelSessionContext);
    // La guardia de la ruta ya corrió. Se repite aquí para que la pieza no
    // dependa de bajo qué layout quedó declarada la ruta.
    const member = await verifyAdminMember(args.request, client);
    // `run` lee de aquí quién envía, ya comprobado.
    args.context.set(panelMemberContext, member);

    const { result, change } = await runChange(definition, args);
    if (change === null) return result;
    const details = describeChange<Field>(change, auditedFields);
    if (details === null) return result;

    await recordChange(
      {
        actorId: member.id,
        action: name,
        entity,
        entityId: change.entityId,
        details:
          change.entityId === null
            ? { key: change.entityKey, ...details }
            : details,
      },
      change.entityId ?? change.entityKey,
      args.request,
    );
    return result;
  }

  definedActions.add(action);
  return action;
}
