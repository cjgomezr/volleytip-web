import { isDeepStrictEqual } from "node:util";

import { isUuid } from "../is-uuid";
import {
  MARKETS_FIELDS,
  type MarketFieldErrors,
  type MarketFormValues,
  type MarketOutcome,
} from "../admin/markets";
import {
  MARKET_PAYMENT_METHODS,
  isMarketPaymentMethod,
} from "../payment-methods";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { findBrokenRule } from "./database-rule.server";
import { reject, type SaveOutcome } from "./editor-input.server";
import { readPanelLanguages } from "./markets-view.server";

const LAST_ACTIVE_RULE = "markets_last_active_check";
const ACTIVE_LOCALE_RULE = "markets_default_locale_active_check";

/** Las columnas que se escriben, que son también las que audita la bitácora. */
export const MARKET_AUDITED_FIELDS = [
  "is_active",
  "ships_physical",
  "default_locale",
  "payment_methods",
] as const;

interface MarketColumns {
  readonly is_active: boolean;
  readonly ships_physical: boolean;
  readonly default_locale: string;
  readonly payment_methods: string[];
}

type Result = SaveOutcome<
  MarketOutcome,
  (typeof MARKET_AUDITED_FIELDS)[number]
>;

interface Submission {
  readonly id: string;
  readonly values: MarketFormValues;
}

// Cada casilla llega con un "false" oculto delante: si no llega nada, el
// envío está roto y no se toma por una casilla sin marcar.
function readCheckbox(formData: FormData, name: string): boolean | undefined {
  const values = formData.getAll(name);
  return values.length === 0 ? undefined : values.includes("true");
}

function readSubmission(formData: FormData): Submission | undefined {
  const id = formData.get(MARKETS_FIELDS.id);
  const defaultLocale = formData.get(MARKETS_FIELDS.defaultLocale);
  const isActive = readCheckbox(formData, MARKETS_FIELDS.isActive);
  const shipsPhysical = readCheckbox(formData, MARKETS_FIELDS.shipsPhysical);
  if (typeof id !== "string" || !isUuid(id)) return undefined;
  if (typeof defaultLocale !== "string") return undefined;
  if (isActive === undefined || shipsPhysical === undefined) return undefined;
  const paymentMethods = formData
    .getAll(MARKETS_FIELDS.paymentMethods)
    .map(String);
  return {
    id,
    values: { isActive, shipsPhysical, defaultLocale, paymentMethods },
  };
}

function rejectMalformed(id: string): Result {
  return reject<MarketOutcome>({
    status: "invalid",
    id,
    errors: {},
    formError: "malformed",
  });
}

function rejectValues(
  { id, values }: Submission,
  errors: MarketFieldErrors,
  formError: "lastActiveMarket" | null = null,
): Result {
  return reject<MarketOutcome>({
    status: "invalid",
    id,
    values,
    errors,
    formError,
  });
}

// En el orden de la lista y sin repetidos: así dos envíos iguales se ven
// iguales, también en la bitácora.
function sortMethods(methods: readonly string[]): string[] {
  return MARKET_PAYMENT_METHODS.filter((method) => methods.includes(method));
}

async function findFieldErrors(
  client: TypedSupabaseClient,
  { defaultLocale, paymentMethods }: MarketFormValues,
): Promise<MarketFieldErrors> {
  const languages = await readPanelLanguages(client);
  const isLocaleActive = languages.some(
    ({ code, isActive }) => code === defaultLocale && isActive,
  );
  return {
    ...(isLocaleActive ? {} : { defaultLocale: "inactiveLanguage" }),
    ...(paymentMethods.every(isMarketPaymentMethod)
      ? {}
      : { paymentMethods: "unknownMethod" }),
  };
}

async function readStoredMarket(
  client: TypedSupabaseClient,
  id: string,
): Promise<MarketColumns | undefined> {
  const { data, error } = await client
    .from("markets")
    .select("is_active, ships_physical, default_locale, payment_methods")
    .eq("id", id);
  if (error !== null) {
    throw new Error(`No se pudo leer el mercado ${id}: ${error.message}`, {
      cause: error,
    });
  }
  const row = data[0];
  return (
    row && {
      is_active: row.is_active,
      ships_physical: row.ships_physical,
      default_locale: row.default_locale,
      payment_methods: sortMethods(row.payment_methods),
    }
  );
}

interface MarketWrite {
  readonly submission: Submission;
  readonly before: MarketColumns;
  readonly after: MarketColumns;
}

async function writeMarket(
  client: TypedSupabaseClient,
  { submission, before, after }: MarketWrite,
): Promise<Result> {
  const { id } = submission;
  const { data, error } = await client
    .from("markets")
    .update(after)
    .eq("id", id)
    .select("id");
  const rule =
    error === null
      ? undefined
      : findBrokenRule(error, [LAST_ACTIVE_RULE, ACTIVE_LOCALE_RULE]);
  if (rule === LAST_ACTIVE_RULE) {
    return rejectValues(submission, {}, "lastActiveMarket");
  }
  if (rule === ACTIVE_LOCALE_RULE) {
    return rejectValues(submission, { defaultLocale: "inactiveLanguage" });
  }
  if (error !== null || data.length === 0) {
    throw new Error(
      `No se pudo guardar el mercado ${id}: ${error?.message ?? "la base no cambió ninguna fila"}`,
      { cause: error },
    );
  }
  return {
    result: { status: "saved", id },
    change: { entityId: id, before: { ...before }, after: { ...after } },
  };
}

/** Valida y guarda un mercado con la sesión de la persona. Que siempre quede
 * uno activo lo decide la base. */
export async function saveMarket(
  client: TypedSupabaseClient,
  formData: FormData,
): Promise<Result> {
  const submission = readSubmission(formData);
  if (submission === undefined) return rejectMalformed("");
  const { id, values } = submission;
  const before = await readStoredMarket(client, id);
  if (before === undefined) return rejectMalformed(id);
  const errors = await findFieldErrors(client, values);
  if (Object.keys(errors).length > 0) return rejectValues(submission, errors);
  const after: MarketColumns = {
    is_active: values.isActive,
    ships_physical: values.shipsPhysical,
    default_locale: values.defaultLocale,
    payment_methods: sortMethods(values.paymentMethods),
  };
  if (isDeepStrictEqual(before, after)) {
    return { result: { status: "unchanged", id }, change: null };
  }
  return writeMarket(client, { submission, before, after });
}
