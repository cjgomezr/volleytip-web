import type { AdminModule, ModuleOverviewCard } from "../admin/modules";
import type {
  ActivityEntry,
  CardLink,
  Loaded,
  OverviewData,
  RejectionCount,
} from "../admin/overview";
import type { TypedSupabaseClient } from "../supabase/typed-client";

const RECENT_ACTIVITY_SIZE = 10;
/** Hoy y los seis días anteriores, en UTC como los cuenta la base. */
const REJECTION_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = "2026-01-01".length;
const COUNT_ONLY = { count: "exact", head: true } as const;

interface LinkedCard extends ModuleOverviewCard {
  readonly id: string;
  readonly link: CardLink;
}

interface CountResult {
  readonly count: number | null;
  readonly error: object | null;
  readonly status: number;
}

// `head: true` cuenta en la base sin traer filas. Su respuesta no tiene
// cuerpo, así que de un error solo se sabe el estado.
async function takeCount(query: PromiseLike<CountResult>): Promise<number> {
  const { count, error, status } = await query;
  if (error !== null || count === null) {
    throw new Error(`La base no devolvió el conteo (estado ${status})`, {
      cause: error,
    });
  }
  return count;
}

function countWaitlist(
  client: TypedSupabaseClient,
  kind: "app" | "camp_notify",
): Promise<number> {
  return takeCount(
    client.from("waitlists").select("id", COUNT_ONLY).eq("kind", kind),
  );
}

// Las tarjetas de lo que el sitio ya guarda. Cada una enlaza cuando su
// sección se registre con ese id; la bandeja de mensajes lee `?estado=`.
const BASE_CARDS: readonly LinkedCard[] = [
  {
    id: "new-messages",
    labelKey: "panel.overview.card.newMessages",
    link: { moduleId: "messages", search: "?estado=new" },
    count: (client) =>
      takeCount(
        client.from("messages").select("id", COUNT_ONLY).eq("status", "new"),
      ),
  },
  {
    id: "app-waitlist",
    labelKey: "panel.overview.card.appWaitlist",
    link: { moduleId: "app-waitlist" },
    count: (client) => countWaitlist(client, "app"),
  },
  {
    id: "camp-notify",
    labelKey: "panel.overview.card.campNotify",
    link: { moduleId: "camp-notify" },
    count: (client) => countWaitlist(client, "camp_notify"),
  },
];

function listCards(modules: readonly AdminModule[]): readonly LinkedCard[] {
  const moduleCards = modules.flatMap(({ id, overviewCard }) =>
    overviewCard ? [{ ...overviewCard, id, link: { moduleId: id } }] : [],
  );
  return [...BASE_CARDS, ...moduleCards];
}

// Un dato que no se puede leer no tumba el resumen: queda en el registro y su
// bloque lo dice.
async function settle<Value>(
  what: string,
  read: () => Promise<Value>,
): Promise<Loaded<Value>> {
  try {
    return { status: "ok", value: await read() };
  } catch (error) {
    console.error(`El resumen del panel no pudo leer "${what}"`, error);
    return { status: "failed" };
  }
}

async function readActivity(
  client: TypedSupabaseClient,
): Promise<readonly ActivityEntry[]> {
  const { data, error } = await client
    .from("audit_log")
    .select("id, action, created_at, actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_ACTIVITY_SIZE);
  if (error !== null) {
    throw new Error(`No se pudo leer la bitácora: ${error.message}`, {
      cause: error,
    });
  }
  return data.map(({ id, action, created_at, actor }) => ({
    id,
    action,
    createdAt: created_at,
    actorName:
      actor === null ? null : actor.full_name?.trim() || String(actor.email),
  }));
}

async function readRejections(
  client: TypedSupabaseClient,
  now: Date,
): Promise<readonly RejectionCount[]> {
  const firstDay = new Date(
    now.getTime() - (REJECTION_DAYS - 1) * MILLISECONDS_PER_DAY,
  );
  const { data, error } = await client
    .from("form_rejections")
    .select("form, reason, count")
    .gte("day", firstDay.toISOString().slice(0, ISO_DATE_LENGTH));
  if (error !== null) {
    throw new Error(`No se pudieron leer los descartes: ${error.message}`, {
      cause: error,
    });
  }
  return data;
}

interface OverviewRequest {
  readonly modules: readonly AdminModule[];
  readonly now: Date;
}

/**
 * Lee lo que muestra el resumen del panel (FR-059) con el cliente de la
 * sesión: las políticas RLS de admin aplican a cada consulta.
 */
export async function readOverview(
  client: TypedSupabaseClient,
  { modules, now }: OverviewRequest,
): Promise<OverviewData> {
  const [cards, activity, rejections] = await Promise.all([
    Promise.all(
      listCards(modules).map(async ({ id, labelKey, link, count }) => ({
        id,
        labelKey,
        link,
        count: await settle(id, () => count(client)),
      })),
    ),
    settle("audit_log", () => readActivity(client)),
    settle("form_rejections", () => readRejections(client, now)),
  ]);
  return { cards, activity, rejections };
}
