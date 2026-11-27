import { isBlankText } from "../admin/site-texts";
import {
  CREATED_PARAM,
  MAX_FAQ_ANSWER_LENGTH,
  MAX_FAQ_QUESTION_LENGTH,
  type FaqEditorView,
  type FaqLanguage,
  type FaqListView,
  type FaqRowView,
  type FaqStatus,
  type FaqText,
} from "../admin/faqs";
import type { Language } from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import { readPanelLanguages } from "./markets-view.server";

// Las preguntas como las ve el panel: todas, con la sesión de un admin.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id, status, faq_translations(locale, question, answer)";

export interface StoredFaq {
  readonly id: string;
  readonly status: FaqStatus;
  /** Por código de idioma. */
  readonly texts: Readonly<Record<string, FaqText>>;
}

interface FaqRecord {
  readonly id: string;
  readonly status: FaqStatus;
  readonly faq_translations: readonly (FaqText & {
    readonly locale: string;
  })[];
}

/** Dice si un texto puede ser el id de una pregunta. Con otra cosa la base
 * rechaza la consulta en vez de no encontrar nada. */
export function isFaqId(id: string): boolean {
  return UUID.test(id);
}

function toStoredFaq({ id, status, faq_translations }: FaqRecord): StoredFaq {
  return {
    id,
    status,
    texts: Object.fromEntries(
      faq_translations.map(({ locale, question, answer }) => [
        locale,
        { question, answer },
      ]),
    ),
  };
}

function failReading(error: { message: string }): never {
  throw new Error(`No se pudieron leer las preguntas: ${error.message}`, {
    cause: error,
  });
}

// El mismo orden que el sitio (`readFaqs`) y que `move_faq` en la base.
async function readAllFaqs(
  client: TypedSupabaseClient,
): Promise<readonly StoredFaq[]> {
  const { data, error } = await client
    .from("faqs")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error !== null) failReading(error);
  return data.map(toStoredFaq);
}

/** Una pregunta, o `null` si no existe. */
export async function readStoredFaq(
  client: TypedSupabaseClient,
  id: string,
): Promise<StoredFaq | null> {
  if (!isFaqId(id)) return null;
  const { data, error } = await client
    .from("faqs")
    .select(COLUMNS)
    .eq("id", id);
  if (error !== null) failReading(error);
  const [record] = data;
  return record === undefined ? null : toStoredFaq(record);
}

/** Los idiomas activos de `languages`, el idioma por defecto primero. */
export async function readFaqLanguages(
  client: TypedSupabaseClient,
): Promise<readonly Omit<FaqLanguage, "isTranslated">[]> {
  const languages = await readPanelLanguages(client);
  return languages
    .filter(({ isActive }) => isActive)
    .map(({ code, name, isDefault }) => ({ code, name, isDefault }));
}

/** Una traducción cuenta si tiene sus dos mitades. */
export function isCompleteText(text: FaqText | undefined): boolean {
  return (
    text !== undefined &&
    !isBlankText(text.question) &&
    !isBlankText(text.answer)
  );
}

function markTranslated(
  languages: readonly Omit<FaqLanguage, "isTranslated">[],
  texts: StoredFaq["texts"],
): readonly FaqLanguage[] {
  return languages.map((language) => ({
    ...language,
    isTranslated: isCompleteText(texts[language.code]),
  }));
}

function pickTitle(
  texts: StoredFaq["texts"],
  languages: readonly Omit<FaqLanguage, "isTranslated">[],
): Pick<FaqRowView, "question" | "questionLanguage"> {
  const codes = [...languages.map(({ code }) => code), ...Object.keys(texts)];
  const code = codes.find(
    (candidate) => !isBlankText(texts[candidate]?.question ?? ""),
  );
  return code === undefined
    ? { question: "", questionLanguage: "" }
    : { question: texts[code]?.question ?? "", questionLanguage: code };
}

function nameLanguage(code: string, panelLanguage: Language): string {
  const names = new Intl.DisplayNames([panelLanguage], { type: "language" });
  return names.of(code) ?? code;
}

interface ListOptions {
  readonly language: Language;
  readonly url: URL;
}

/** Lo que pinta la lista, leído con la sesión de la persona. */
export async function readFaqList(
  client: TypedSupabaseClient,
  { language, url }: ListOptions,
): Promise<FaqListView> {
  const [faqs, active] = await Promise.all([
    readAllFaqs(client),
    readFaqLanguages(client),
  ]);
  const named = active.map((entry) => ({
    ...entry,
    name: nameLanguage(entry.code, language),
  }));
  const asked = url.searchParams.get(CREATED_PARAM);
  // Viene de la dirección: solo vale mientras sea un borrador de la lista.
  const created = faqs.find(
    ({ id, status }) => id === asked && status === "draft",
  );
  return {
    rows: faqs.map(({ id, status, texts }) => ({
      id,
      status,
      ...pickTitle(texts, active),
      languages: markTranslated(named, texts),
    })),
    createdId: created?.id ?? null,
  };
}

/** Lo que pinta el editor de una pregunta, o el de una nueva sin `faq`. */
export async function buildFaqEditorView(
  client: TypedSupabaseClient,
  faq: StoredFaq | null,
): Promise<FaqEditorView> {
  const languages = await readFaqLanguages(client);
  const texts = faq?.texts ?? {};
  return {
    faqId: faq?.id ?? null,
    status: faq?.status ?? null,
    languages: markTranslated(languages, texts),
    texts,
    limits: {
      question: MAX_FAQ_QUESTION_LENGTH,
      answer: MAX_FAQ_ANSWER_LENGTH,
    },
  };
}
