import { isDeepStrictEqual } from "node:util";

import { data, redirect, type ActionFunctionArgs } from "react-router";

import {
  CREATED_PARAM,
  type FaqSaveOutcome,
  type FaqText,
} from "../admin/faqs";
import type { Json } from "../database.types";
import { getRequestLanguage } from "../i18n/languages";
import { getPanelPath } from "../i18n/panel-pages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import type { AdminActionOutcome } from "./admin-action.server";
import { findBrokenRule } from "./database-rule.server";
import { reject, type SaveOutcome } from "./editor-input.server";
import { readFaqSubmission, type FaqSubmission } from "./faq-input.server";
import {
  isCompleteText,
  readFaqLanguages,
  readStoredFaq,
  type StoredFaq,
} from "./faqs-reader.server";
import { panelSessionContext } from "./panel-middleware.server";

// Crear y editar una pregunta. La base escribe la pregunta y sus traducciones
// en una sola operación.

const SEE_OTHER = 303;
const NOT_FOUND_STATUS = 404;
const DEFAULT_TEXT_RULE = "faqs_published_default_text_check";

type Texts = Readonly<Record<string, FaqText>>;

type CreateResult = AdminActionOutcome<
  Response | ReturnType<typeof data<FaqSaveOutcome>>,
  "status" | "sort_order" | "translations"
>;
type UpdateResult = SaveOutcome<FaqSaveOutcome, "translations">;

interface FormRules {
  readonly isPublished: boolean;
}

async function readSubmission(
  client: TypedSupabaseClient,
  formData: FormData,
  { isPublished }: FormRules,
): Promise<{ submission: FaqSubmission; codes: readonly string[] }> {
  const languages = await readFaqLanguages(client);
  const defaultCode = languages.find(({ isDefault }) => isDefault)?.code;
  if (defaultCode === undefined) {
    throw new Error("La tabla de idiomas no tiene un idioma por defecto.");
  }
  const codes = languages.map(({ code }) => code);
  return {
    submission: readFaqSubmission(formData, {
      codes,
      defaultCode,
      isPublished,
    }),
    codes,
  };
}

function isRejected({ fieldErrors, formError }: FaqSubmission): boolean {
  return formError !== null || Object.keys(fieldErrors).length > 0;
}

function rejectSubmission({
  values,
  fieldErrors,
  formError,
}: Omit<FaqSubmission, "texts">): ReturnType<typeof reject<FaqSaveOutcome>> {
  return reject<FaqSaveOutcome>({
    status: "invalid",
    values,
    fieldErrors,
    formError,
  });
}

function toRows(texts: Texts): { [key: string]: string }[] {
  return Object.entries(texts).map(([locale, { question, answer }]) => ({
    locale,
    question,
    answer,
  }));
}

// Como objeto de JSON: es lo que guarda la bitácora.
function toAudited(texts: Texts): Json {
  return Object.fromEntries(
    Object.entries(texts).map(([locale, { question, answer }]) => [
      locale,
      { question, answer },
    ]),
  );
}

function isCreated(value: Json): value is { id: string; sort_order: number } {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    typeof value.sort_order === "number"
  );
}

/** Crea una pregunta en borrador, al final del orden, y vuelve a la lista. */
export async function createFaq({
  request,
  context,
}: ActionFunctionArgs): Promise<CreateResult> {
  const { client } = context.get(panelSessionContext);
  const { submission } = await readSubmission(
    client,
    await request.formData(),
    { isPublished: false },
  );
  if (isRejected(submission)) return rejectSubmission(submission);
  const { data: created, error } = await client.rpc("create_faq", {
    p_translations: toRows(submission.texts),
  });
  if (error !== null || !isCreated(created)) {
    throw new Error(
      `No se pudo crear la pregunta: ${error?.message ?? "la base no devolvió su id"}`,
      { cause: error },
    );
  }
  const list = getPanelPath("adminFaqs", getRequestLanguage(request));
  return {
    result: redirect(`${list}?${CREATED_PARAM}=${created.id}`, SEE_OTHER),
    change: {
      entityId: created.id,
      before: null,
      after: {
        status: "draft",
        sort_order: created.sort_order,
        translations: toAudited(submission.texts),
      },
    },
  };
}

interface TranslationChange {
  readonly before: Texts;
  readonly after: Texts;
  readonly written: Texts;
  readonly removed: readonly string[];
}

// Solo se miran los idiomas del formulario: los de un idioma desactivado se
// quedan como están.
function compareTexts(
  faq: StoredFaq,
  submitted: Texts,
  codes: readonly string[],
): TranslationChange {
  const before = Object.fromEntries(
    Object.entries(faq.texts).filter(([code]) => codes.includes(code)),
  );
  const written = Object.fromEntries(
    Object.entries(submitted).filter(
      ([code, text]) => !isDeepStrictEqual(before[code], text),
    ),
  );
  const removed = Object.keys(before).filter(
    (code) => submitted[code] === undefined && isCompleteText(before[code]),
  );
  return { before, after: submitted, written, removed };
}

async function writeFaq(
  client: TypedSupabaseClient,
  faqId: string,
  { written, removed }: TranslationChange,
): Promise<"saved" | "missingDefaultText"> {
  const { error } = await client.rpc("save_faq", {
    p_faq_id: faqId,
    p_translations: toRows(written),
    p_removed_locales: [...removed],
  });
  if (error === null) return "saved";
  if (findBrokenRule(error, [DEFAULT_TEXT_RULE])) return "missingDefaultText";
  throw new Error(`No se pudo guardar la pregunta: ${error.message}`, {
    cause: error,
  });
}

/** Valida y guarda las traducciones de la pregunta de la dirección. Responde
 * 404 si no existe. */
export async function updateFaq({
  request,
  context,
  params,
}: ActionFunctionArgs): Promise<UpdateResult> {
  const { client } = context.get(panelSessionContext);
  const faq = await readStoredFaq(client, params.faqId ?? "");
  if (faq === null) throw data(null, { status: NOT_FOUND_STATUS });
  const { submission, codes } = await readSubmission(
    client,
    await request.formData(),
    { isPublished: faq.status === "published" },
  );
  if (isRejected(submission)) return rejectSubmission(submission);
  const change = compareTexts(faq, submission.texts, codes);
  const hasChanges =
    Object.keys(change.written).length > 0 || change.removed.length > 0;
  if (!hasChanges) return { result: { status: "unchanged" }, change: null };
  if ((await writeFaq(client, faq.id, change)) === "missingDefaultText") {
    return rejectSubmission({
      values: submission.values,
      fieldErrors: {},
      formError: "publishedNeedsDefault",
    });
  }
  return {
    result: { status: "saved" },
    change: {
      entityId: faq.id,
      before: { translations: toAudited(change.before) },
      after: { translations: toAudited(change.after) },
    },
  };
}
