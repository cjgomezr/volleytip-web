import { MARKETS_FIELDS, type LanguageOutcome } from "../admin/markets";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { findBrokenRule } from "./database-rule.server";
import { reject, type SaveOutcome } from "./editor-input.server";

const DEFAULT_LANGUAGE_RULE = "languages_default_active_check";

type Result = SaveOutcome<LanguageOutcome, "is_active">;

function rejectLanguage(
  code: string,
  error: "defaultLanguage" | "malformed",
): Result {
  return reject<LanguageOutcome>({ status: "invalid", code, error });
}

async function readIsActive(
  client: TypedSupabaseClient,
  code: string,
): Promise<boolean | undefined> {
  const { data, error } = await client
    .from("languages")
    .select("is_active")
    .eq("code", code);
  if (error !== null) {
    throw new Error(`No se pudo leer el idioma "${code}": ${error.message}`, {
      cause: error,
    });
  }
  return data[0]?.is_active;
}

/** Activa o desactiva un idioma con la sesión de la persona. Que el idioma por
 * defecto no se apague lo decide la base. */
export async function saveLanguageState(
  client: TypedSupabaseClient,
  formData: FormData,
): Promise<Result> {
  const code = formData.get(MARKETS_FIELDS.code);
  const requested = formData.get(MARKETS_FIELDS.isActive);
  if (
    typeof code !== "string" ||
    (requested !== "true" && requested !== "false")
  ) {
    return rejectLanguage("", "malformed");
  }
  const isActive = requested === "true";
  const wasActive = await readIsActive(client, code);
  if (wasActive === undefined) return rejectLanguage(code, "malformed");
  if (wasActive === isActive) {
    return { result: { status: "unchanged", code }, change: null };
  }
  const { data, error } = await client
    .from("languages")
    .update({ is_active: isActive })
    .eq("code", code)
    .select("code");
  if (error !== null && findBrokenRule(error, [DEFAULT_LANGUAGE_RULE])) {
    return rejectLanguage(code, "defaultLanguage");
  }
  if (error !== null || data.length === 0) {
    throw new Error(
      `No se pudo guardar el idioma "${code}": ${error?.message ?? "la base no cambió ninguna fila"}`,
      { cause: error },
    );
  }
  return {
    result: { status: "saved", code },
    change: {
      entityId: null,
      entityKey: code,
      before: { is_active: wasActive },
      after: { is_active: isActive },
    },
  };
}
