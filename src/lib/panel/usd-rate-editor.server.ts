import {
  MARKETS_FIELDS,
  type RateError,
  type RateOutcome,
} from "../admin/markets";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { USD_REFERENCE_RATE } from "../usd-rate.server";
import { reject, type SaveOutcome } from "./editor-input.server";
import { readStoredSetting, replaceSetting } from "./stored-setting.server";

const ONLY_DIGITS = /^\d+$/;

/** La tasa que el panel acepta: pesos por dólar, entero y mayor que cero. */
export function isUsdRate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

type RateReview =
  | { readonly isValid: true; readonly rate: number }
  | { readonly isValid: false; readonly error: RateError };

// Solo dígitos: "4.000" no se adivina como cuatro mil ni como cuatro.
function reviewRate(typed: string): RateReview {
  const text = typed.trim();
  if (text === "") return { isValid: false, error: "required" };
  const rate = ONLY_DIGITS.test(text) ? Number(text) : Number.NaN;
  return isUsdRate(rate)
    ? { isValid: true, rate }
    : { isValid: false, error: "notPositiveInteger" };
}

/** Valida y guarda la tasa de referencia del dólar (FR-122). */
export async function saveUsdRate(
  client: TypedSupabaseClient,
  formData: FormData,
): Promise<SaveOutcome<RateOutcome, "value">> {
  const submitted = formData.get(MARKETS_FIELDS.rate);
  const value = typeof submitted === "string" ? submitted : "";
  const review = reviewRate(value);
  if (!review.isValid) {
    return reject<RateOutcome>({
      status: "invalid",
      value,
      error: review.error,
    });
  }
  const previous = await readStoredSetting(USD_REFERENCE_RATE, client);
  const change = await replaceSetting({
    client,
    key: USD_REFERENCE_RATE.key,
    previous,
    value: review.rate,
  });
  return {
    result: { status: change === null ? "unchanged" : "saved" },
    change,
  };
}
