import { describeActor } from "../admin/audit-actor";
import type { AdminModule, ModuleOverviewCard } from "../admin/modules";
import {
  APP_WAITLIST_CARD,
  CAMP_NOTIFY_CARD,
  NEW_MESSAGES_CARD,
  type ActivityEntry,
  type CardDefinition,
  type Loaded,
  type OverviewData,
  type RejectionCount,
} from "../admin/overview";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { COUNT_ONLY, takeCount } from "./database-count.server";
import { countNewMessages } from "./messages-inbox.server";

const RECENT_ACTIVITY_SIZE = 10;
/** Hoy y los seis días anteriores, en UTC como los cuenta la base. */
const REJECTION_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = "2026-01-01".length;

type CountedCard = CardDefinition & Pick<ModuleOverviewCard, "count">;

function countWaitlist(
  client: TypedSupabaseClient,
  kind: "app" | "camp_notify",
): Promise<number> {
  return takeCount(
    client.from("waitlists").select("id", COUNT_ONLY).eq("kind", kind),
  );
}

const BASE_CARDS: readonly CountedCard[] = [
  { ...NEW_MESSAGES_CARD, count: countNewMessages },
  { ...APP_WAITLIST_CARD, count: (client) => countWaitlist(client, "app") },
  {
    ...CAMP_NOTIFY_CARD,
    count: (client) => countWaitlist(client, "camp_notify"),
  },
];

function listCards(modules: readonly AdminModule[]): readonly CountedCard[] {
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
    actorName: describeActor(actor),
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
      listCards(modules).map(async ({ count, ...card }) => ({
        ...card,
        count: await settle(card.id, () => count(client)),
      })),
    ),
    settle("audit_log", () => readActivity(client)),
    settle("form_rejections", () => readRejections(client, now)),
  ]);
  return { cards, activity, rejections };
}
