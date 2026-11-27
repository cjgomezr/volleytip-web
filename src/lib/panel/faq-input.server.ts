import {
  faqField,
  MAX_FAQ_ANSWER_LENGTH,
  MAX_FAQ_QUESTION_LENGTH,
  type FaqFieldError,
  type FaqFormError,
  type FaqPart,
  type FaqText,
} from "../admin/faqs";
import { isBlankText } from "../admin/site-texts";
import { findTextError, normalizeText } from "./editor-input.server";

// La validación de lo que envía el editor de una pregunta.

const MAX_LENGTHS: Readonly<Record<FaqPart, number>> = {
  question: MAX_FAQ_QUESTION_LENGTH,
  answer: MAX_FAQ_ANSWER_LENGTH,
};
const PARTS = ["question", "answer"] as const;

// La respuesta es de varias líneas: el sitio respeta sus saltos. El navegador
// los manda como CRLF; los demás caracteres de control no se ven.
function normalizeAnswer(text: string): string {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n\t]+/gu, " ")
    .trim();
  return isBlankText(cleaned) ? "" : cleaned;
}

const NORMALIZERS: Readonly<Record<FaqPart, (text: string) => string>> = {
  question: normalizeText,
  answer: normalizeAnswer,
};

export interface FaqSubmission {
  /** Lo que llegó, tal cual, para volver a pintarlo. */
  readonly values: Readonly<Record<string, string>>;
  /** Las traducciones completas, ya limpias, por código de idioma. */
  readonly texts: Readonly<Record<string, FaqText>>;
  readonly fieldErrors: Readonly<Record<string, FaqFieldError>>;
  readonly formError: FaqFormError | null;
}

interface SubmissionRules {
  /** Los idiomas activos: los campos que el formulario tiene que traer. */
  readonly codes: readonly string[];
  readonly defaultCode: string;
  /** Una pregunta publicada no se queda sin el idioma por defecto. */
  readonly isPublished: boolean;
}

interface LanguageInput {
  readonly code: string;
  readonly text: FaqText;
  readonly fieldErrors: readonly (readonly [string, FaqFieldError])[];
}

function checkLanguage(
  code: string,
  values: Readonly<Record<string, string>>,
): LanguageInput {
  const read = (part: FaqPart): string =>
    NORMALIZERS[part](values[faqField(part, code)] ?? "");
  const text = { question: read("question"), answer: read("answer") };
  const hasAny = PARTS.some((part) => text[part] !== "");
  const fieldErrors = PARTS.flatMap((part) => {
    // Una traducción lleva las dos mitades o ninguna. El largo se mide sobre
    // lo limpio, que es lo que se guarda.
    const error = findTextError(text[part], {
      maxLength: MAX_LENGTHS[part],
      isRequired: hasAny,
    });
    return error ? [[faqField(part, code), error] as const] : [];
  });
  return { code, text, fieldErrors };
}

function readValues(
  formData: FormData,
  codes: readonly string[],
): Readonly<Record<string, string>> {
  const names = codes.flatMap((code) =>
    PARTS.map((part) => faqField(part, code)),
  );
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = formData.get(name);
      return typeof value === "string" ? [[name, value] as const] : [];
    }),
  );
}

function requireDefault(defaultCode: string): Record<string, FaqFieldError> {
  return Object.fromEntries(
    PARTS.map((part) => [faqField(part, defaultCode), "required" as const]),
  );
}

export function readFaqSubmission(
  formData: FormData,
  { codes, defaultCode, isPublished }: SubmissionRules,
): FaqSubmission {
  const values = readValues(formData, codes);
  const inputs = codes.map((code) => checkLanguage(code, values));
  const fieldErrors = Object.fromEntries(
    inputs.flatMap((input) => input.fieldErrors),
  );
  const texts = Object.fromEntries(
    inputs
      .filter(({ text }) => text.question !== "" && text.answer !== "")
      .map(({ code, text }) => [code, text]),
  );
  const submission = { values, texts, fieldErrors };
  // Un campo que no llega no es un campo vacío: tomarlo así borraría su
  // traducción.
  if (Object.keys(values).length !== codes.length * PARTS.length) {
    return { ...submission, formError: "malformed" };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ...submission, formError: null };
  }
  const missing = isPublished && texts[defaultCode] === undefined;
  if (missing || Object.keys(texts).length === 0) {
    return {
      ...submission,
      fieldErrors: requireDefault(defaultCode),
      formError: missing ? "publishedNeedsDefault" : "noLanguage",
    };
  }
  return { ...submission, formError: null };
}
