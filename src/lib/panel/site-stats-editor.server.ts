import {
  normalizeText,
  statField,
  type FieldErrors,
  type LocalizedDraft,
  type SiteStatDraft,
  type SiteStatPart,
  type StatsOutcome,
} from "../admin/site-texts";
import type { Language } from "../i18n/languages";
import {
  MAX_STAT_LABEL_LENGTH,
  MAX_STAT_VALUE_LENGTH,
  SITE_STAT_IDS,
  type SiteStatId,
} from "../site-stats.server";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import type { AuditedChange } from "./admin-action.server";
import {
  buildDraft,
  findTextError,
  LANGUAGES,
  reject,
  type SaveOutcome,
} from "./editor-input.server";

/** La clave con que la bitácora nombra un guardado de las cifras. */
const STATS_AUDIT_KEY = "stats";
const MAX_STAT_LENGTHS: Readonly<Record<SiteStatPart, number>> = {
  value: MAX_STAT_VALUE_LENGTH,
  label: MAX_STAT_LABEL_LENGTH,
};

interface StatTextField {
  /** El nombre en el formulario y en la bitácora. */
  readonly name: string;
  readonly id: SiteStatId;
  readonly part: SiteStatPart;
  readonly key: string;
  readonly locale: Language;
}

const STAT_FIELDS: readonly StatTextField[] = SITE_STAT_IDS.flatMap((id) =>
  (["value", "label"] as const).flatMap((part) =>
    LANGUAGES.map((locale) => ({
      name: statField(id, part, locale),
      id,
      part,
      key: `stats.${id}.${part}`,
      locale,
    })),
  ),
);

function requireNonEmpty(items: readonly string[]): [string, ...string[]] {
  const [first, ...rest] = items;
  if (first === undefined) {
    throw new Error("No hay ningún campo de cifras que auditar");
  }
  return [first, ...rest];
}

/** Los campos que la bitácora compara en un guardado de las cifras. */
export const STAT_AUDITED_FIELDS = requireNonEmpty(
  STAT_FIELDS.map(({ name }) => name),
);

/** Los textos guardados de las cifras, por nombre de campo. */
export async function readStoredStats(
  client: TypedSupabaseClient,
): Promise<ReadonlyMap<string, string>> {
  const { data: rows, error } = await client
    .from("site_texts")
    .select("key, locale, value")
    .in("key", [...new Set(STAT_FIELDS.map(({ key }) => key))])
    .in("locale", [...LANGUAGES]);
  if (error !== null) {
    throw new Error(`No se pudieron leer las cifras: ${error.message}`, {
      cause: error,
    });
  }
  return new Map(
    rows.map(({ key, locale, value }) => [`${key}:${locale}`, value]),
  );
}

export function describeStat(
  id: SiteStatId,
  stored: ReadonlyMap<string, string>,
): SiteStatDraft {
  const read = (part: SiteStatPart): LocalizedDraft =>
    buildDraft((language) => stored.get(statField(id, part, language)) ?? "");
  return { id, value: read("value"), label: read("label") };
}

interface SubmittedStat extends StatTextField {
  readonly text: string;
}

function findStatErrors(submitted: readonly SubmittedStat[]): FieldErrors {
  const errors = submitted.flatMap(({ name, part, text }) => {
    const error = findTextError(text, {
      maxLength: MAX_STAT_LENGTHS[part],
      isRequired: false,
    });
    return error ? [[name, error] as const] : [];
  });
  return Object.fromEntries(errors);
}

function readSubmittedStats(formData: FormData): readonly SubmittedStat[] {
  return STAT_FIELDS.flatMap((field) => {
    const text = formData.get(field.name);
    return typeof text === "string" ? [{ ...field, text }] : [];
  });
}

// Una sola sentencia: o quedan todos los textos o ninguno.
async function writeStats(
  client: TypedSupabaseClient,
  changed: readonly SubmittedStat[],
): Promise<void> {
  const { error } = await client.from("site_texts").upsert(
    changed.map(({ key, locale, text }) => ({ key, locale, value: text })),
    { onConflict: "key,locale" },
  );
  if (error !== null) {
    throw new Error(`No se pudieron guardar las cifras: ${error.message}`, {
      cause: error,
    });
  }
}

// Entran todos los campos: la bitácora solo guarda los que cambiaron.
function describeStatsChange(
  submitted: readonly SubmittedStat[],
  changed: readonly SubmittedStat[],
  stored: ReadonlyMap<string, string>,
): AuditedChange<string> {
  const before = Object.fromEntries(
    submitted.map(({ name }) => [name, stored.get(name) ?? ""]),
  );
  const written = Object.fromEntries(
    changed.map(({ name, text }) => [name, text]),
  );
  return {
    entityId: null,
    entityKey: STATS_AUDIT_KEY,
    before,
    after: { ...before, ...written },
  };
}

/** Valida y guarda las cifras con el cliente de la sesión. Solo escribe los
 * textos que cambiaron. */
export async function saveSiteStats(
  client: TypedSupabaseClient,
  formData: FormData,
): Promise<SaveOutcome<StatsOutcome, string>> {
  const submitted = readSubmittedStats(formData);
  const fieldErrors = findStatErrors(submitted);
  // Un campo que no llega no es un campo vacío: guardarlo así lo borraría.
  const isIncomplete = submitted.length !== STAT_FIELDS.length;
  if (isIncomplete || Object.keys(fieldErrors).length > 0) {
    const values = Object.fromEntries(
      submitted.map(({ name, text }) => [name, text]),
    );
    return reject<StatsOutcome>({
      status: "invalid",
      values,
      fieldErrors,
      formError: isIncomplete ? "malformed" : null,
    });
  }
  const stored = await readStoredStats(client);
  const changed = submitted
    .map((field) => ({ ...field, text: normalizeText(field.text) }))
    .filter(({ name, text }) => text !== normalizeText(stored.get(name) ?? ""));
  if (changed.length === 0) {
    return { result: { status: "unchanged" }, change: null };
  }
  await writeStats(client, changed);
  return {
    result: { status: "saved" },
    change: describeStatsChange(submitted, changed, stored),
  };
}
