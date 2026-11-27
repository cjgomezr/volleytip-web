import { data, redirect, type ActionFunctionArgs } from "react-router";

import {
  CREATED_PARAM,
  type FaqFormError,
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
import { planFaqChange, type TranslationChange } from "./faq-changes.server";
import { readFaqSubmission, type FaqSubmission } from "./faq-input.server";
import { readFaqLanguages, readStoredFaq } from "./faqs-reader.server";
import { panelSessionContext } from "./panel-middleware.server";

// Crear y editar una pregunta. La base escribe la pregunta y sus traducciones
// en una sola operación.

const SEE_OTHER = 303;
const NOT_FOUND_STATUS = 404;
// Las reglas de `save_faq` y el error del formulario que explica cada una.
const REJECTIONS = {
  faqs_published_default_text_check: "publishedNeedsDefault",
  faqs_stale_translation_check: "stale",
} as const;

type Texts = Readonly<Record<string, FaqText>>;

type CreateResult = AdminActionOutcome<
  Response | ReturnType<typeof data<FaqSaveOutcome>>,
  "status" | "sort_order" | "translations"
>;
type UpdateResult = SaveOutcome<FaqSaveOutcome, "translations">;

type FormRules = Pick<
  Parameters<typeof readFaqSubmission>[1],
  "isPublished" | "isEdit"
>;

async function readSubmission(
  client: TypedSupabaseClient,
  formData: FormData,
  rules: FormRules,
): Promise<FaqSubmission> {
  const languages = await readFaqLanguages(client);
  const defaultCode = languages.find(({ isDefault }) => isDefault)?.code;
  if (defaultCode === undefined) {
    throw new Error("La tabla de idiomas no tiene un idioma por defecto.");
  }
  const codes = languages.map(({ code }) => code);
  return readFaqSubmission(formData, { ...rules, codes, defaultCode });
}

function isRejected({ fieldErrors, formError }: FaqSubmission): boolean {
  return formError !== null || Object.keys(fieldErrors).length > 0;
}

function rejectSubmission({
  values,
  fieldErrors,
  formError,
}: Pick<FaqSubmission, "values" | "fieldErrors" | "formError">): ReturnType<
  typeof reject<FaqSaveOutcome>
> {
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
  const submission = await readSubmission(client, await request.formData(), {
    isPublished: false,
    isEdit: false,
  });
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

interface SavedTranslations {
  readonly before: Json;
  readonly after: Json;
}

function isSaved(value: Json): value is Json & SavedTranslations {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.before !== undefined &&
    value.after !== undefined
  );
}

async function writeFaq(
  client: TypedSupabaseClient,
  faqId: string,
  { written, removed, expected }: TranslationChange,
): Promise<SavedTranslations | (typeof REJECTIONS)[keyof typeof REJECTIONS]> {
  const { data: saved, error } = await client.rpc("save_faq", {
    p_faq_id: faqId,
    p_translations: toRows(written),
    p_removed_locales: [...removed],
    p_expected: toRows(expected),
  });
  if (error !== null) {
    const rules = Object.keys(REJECTIONS) as (keyof typeof REJECTIONS)[];
    const broken = findBrokenRule(error, rules);
    if (broken) return REJECTIONS[broken];
  }
  if (error !== null || !isSaved(saved)) {
    throw new Error(
      `No se pudo guardar la pregunta: ${error?.message ?? "la base no devolvió sus traducciones"}`,
      { cause: error },
    );
  }
  return saved;
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
  const submission = await readSubmission(client, await request.formData(), {
    isPublished: faq.status === "published",
    isEdit: true,
  });
  if (isRejected(submission)) return rejectSubmission(submission);
  const rejectWith = (formError: FaqFormError): UpdateResult =>
    rejectSubmission({
      values: submission.values,
      fieldErrors: {},
      formError,
    });
  const change = planFaqChange(faq.texts, submission);
  if (change === "stale") return rejectWith("stale");
  const touched = Object.keys(change.written).length + change.removed.length;
  if (touched === 0) return { result: { status: "unchanged" }, change: null };
  const saved = await writeFaq(client, faq.id, change);
  if (typeof saved === "string") return rejectWith(saved);
  return {
    result: { status: "saved" },
    // Lo que la base leyó con la fila bloqueada.
    change: {
      entityId: faq.id,
      before: { translations: saved.before },
      after: { translations: saved.after },
    },
  };
}
