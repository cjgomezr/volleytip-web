import { isDeepStrictEqual } from "node:util";

import type { ActionFunctionArgs } from "react-router";

import { recordAuditEntry } from "../audit-log.server";
import type { Json } from "../database.types";
import {
  assertAdminMember,
  panelSessionContext,
  verifyPanelMember,
} from "./panel-middleware.server";

// `entidad.verbo`, en minúsculas y con guion bajo: `site_text.update`.
const ACTION_NAME = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;

export type AdminActionName = `${string}.${string}`;

/** Los campos auditados de una fila. Puede traer más: no se registran. */
export type AuditSnapshot<Field extends string> = Readonly<Record<Field, Json>>;

/** Lo que una acción cambió. Sin `before` es una creación y sin `after`, un
 * borrado. */
export type AuditedChange<Field extends string> = {
  /** El id (uuid) de lo que cambió, o `null` si no tiene. */
  readonly entityId: string | null;
} & (
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

export interface AdminActionDefinition<Result, Field extends string> {
  /** Como `entidad.verbo`. La entidad de la bitácora sale de aquí. */
  readonly name: AdminActionName;
  readonly auditedFields: readonly [Field, ...Field[]];
  readonly run: (
    args: ActionFunctionArgs,
  ) => Promise<AdminActionOutcome<Result, NoInfer<Field>>>;
}

export type AdminAction<Result> = (args: ActionFunctionArgs) => Promise<Result>;

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

function pickFields<Field extends string>(
  snapshot: AuditSnapshot<Field>,
  fields: readonly Field[],
): Record<string, Json> {
  return Object.fromEntries(fields.map((field) => [field, snapshot[field]]));
}

/** El antes y el después que van a la bitácora, solo con campos declarados.
 * `null` si ninguno de ellos cambió. */
function describeChange<Field extends string>(
  { before, after }: AuditedChange<Field>,
  auditedFields: readonly Field[],
): AuditedDetails | null {
  if (before === null || after === null) {
    return {
      before: before && pickFields(before, auditedFields),
      after: after && pickFields(after, auditedFields),
    };
  }
  const changed = auditedFields.filter(
    (field) => !isDeepStrictEqual(before[field], after[field]),
  );
  if (changed.length === 0) return null;
  return {
    before: pickFields(before, changed),
    after: pickFields(after, changed),
  };
}

/**
 * La única pieza por la que pasa una escritura del panel (FR-067): comprueba
 * que quien envía sea un admin activo, ejecuta `run` y deja en `audit_log`
 * quién lo hizo y qué cambió. El `action` de una ruta del panel es lo que
 * devuelve esta función.
 *
 * - NUNCA declares en `auditedFields` un secreto, un token ni el cuerpo de un
 *   mensaje de contacto: la bitácora no se puede editar ni borrar.
 * - Solo se compara lo declarado: si `run` cambia algo y ningún campo
 *   declarado se mueve, no queda entrada. Declara al menos uno que cambie con
 *   cada cambio que la acción pueda hacer.
 * - Si `run` lanza, no se registra nada. Por eso una redirección tras un
 *   cambio va en `result`, no se lanza.
 * - Si la bitácora falla, la acción lanza aunque el cambio ya esté hecho. El
 *   error llega al reporte del servidor como cualquier otro de un `action`.
 *
 * La entrada se escribe con el cliente de servicio: `audit_log` no deja
 * insertar a ninguna sesión, tampoco a la de un admin.
 */
export function defineAdminAction<Result, const Field extends string>({
  name,
  auditedFields,
  run,
}: AdminActionDefinition<Result, Field>): AdminAction<Result> {
  const entity = readEntity(name);

  async function action(args: ActionFunctionArgs): Promise<Result> {
    const { client } = args.context.get(panelSessionContext);
    // La guardia de la ruta ya corrió. Se repite aquí para que la pieza no
    // dependa de bajo qué layout quedó declarada la ruta.
    const member = await verifyPanelMember(args.request, client);
    assertAdminMember(member, args.request);

    const { result, change } = await run(args);
    const details = change && describeChange(change, auditedFields);
    if (change === null || details === null) return result;

    await recordChange({
      actorId: member.id,
      action: name,
      entity,
      entityId: change.entityId,
      details,
    });
    return result;
  }

  definedActions.add(action);
  return action;
}

async function recordChange(
  entry: Parameters<typeof recordAuditEntry>[0],
): Promise<void> {
  try {
    await recordAuditEntry(entry);
  } catch (error) {
    // Quien lea el reporte necesita saber qué quedó hecho sin su entrada.
    throw new Error(
      `El cambio "${entry.action}" sobre ${entry.entity} ${entry.entityId ?? "(sin id)"} se hizo, pero no quedó en la bitácora.`,
      { cause: error },
    );
  }
}
