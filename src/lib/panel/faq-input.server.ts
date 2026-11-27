import {
  faqBaseField,
  faqField,
  MAX_FAQ_ANSWER_LENGTH,
  MAX_FAQ_QUESTION_LENGTH,
  type FaqFieldError,
  type FaqFormError,
  type FaqPart,
  type FaqText,
} from "../admin/faqs";
import { isBlankText } from "../admin/site-texts";
import { normalizeText } from "./editor-input.server";

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

/** Una traducción como se guardaría. Sin ella, las dos mitades vacías. */
export function normalizeFaqText(text: FaqText | undefined): FaqText {
  return {
    question: NORMALIZERS.question(text?.question ?? ""),
    answer: NORMALIZERS.answer(text?.answer ?? ""),
  };
}

export interface FaqSubmission {
  /** Lo que llegó, tal cual, para volver a pintarlo. */
  readonly values: Readonly<Record<string, string>>;
  /** Las traducciones completas, ya limpias, por código de idioma. */
  readonly texts: Readonly<Record<string, FaqText>>;
  /** Lo que la pantalla pintó al abrirse, limpio. Vacío al crear. */
  readonly painted: Readonly<Record<string, FaqText>>;
  readonly fieldErrors: Readonly<Record<string, FaqFieldError>>;
  readonly formError: FaqFormError | null;
}

interface SubmissionRules {
  /** Los idiomas activos: los campos que el formulario tiene que traer. */
  readonly codes: readonly string[];
  readonly defaultCode: string;
  /** Una pregunta publicada no se queda sin el idioma por defecto. */
  readonly isPublished: boolean;
  /** Al editar, el formulario trae además lo que pintó. */
  readonly isEdit: boolean;
}

interface LanguageInput {
  readonly code: string;
  readonly text: FaqText;
  readonly fieldErrors: readonly (readonly [string, FaqFieldError])[];
}

// Por caracteres y no por unidades de UTF-16: un emoji cuenta uno. Se mide lo
// limpio, saltos incluidos: es lo que se guarda.
function findFieldError(
  text: string,
  part: FaqPart,
  isRequired: boolean,
): FaqFieldError | undefined {
  if (isRequired && text === "") return "required";
  return [...text].length > MAX_LENGTHS[part] ? "tooLong" : undefined;
}

function readText(
  values: Readonly<Record<string, string>>,
  nameOf: (part: FaqPart) => string,
): FaqText {
  return normalizeFaqText({
    question: values[nameOf("question")] ?? "",
    answer: values[nameOf("answer")] ?? "",
  });
}

function checkLanguage(
  code: string,
  values: Readonly<Record<string, string>>,
): LanguageInput {
  const text = readText(values, (part) => faqField(part, code));
  const hasAny = PARTS.some((part) => text[part] !== "");
  const fieldErrors = PARTS.flatMap((part) => {
    // Una traducción lleva las dos mitades o ninguna.
    const error = findFieldError(text[part], part, hasAny);
    return error ? [[faqField(part, code), error] as const] : [];
  });
  return { code, text, fieldErrors };
}

function listFieldNames({ codes, isEdit }: SubmissionRules): string[] {
  return codes.flatMap((code) =>
    PARTS.flatMap((part) => [
      faqField(part, code),
      ...(isEdit ? [faqBaseField(part, code)] : []),
    ]),
  );
}

function readValues(
  formData: FormData,
  names: readonly string[],
): Readonly<Record<string, string>> {
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

function readTranslations(
  codes: readonly string[],
  values: Readonly<Record<string, string>>,
): Pick<FaqSubmission, "texts" | "painted" | "fieldErrors"> {
  const inputs = codes.map((code) => checkLanguage(code, values));
  return {
    texts: Object.fromEntries(
      inputs
        .filter(({ text }) => text.question !== "" && text.answer !== "")
        .map(({ code, text }) => [code, text]),
    ),
    painted: Object.fromEntries(
      codes.map((code) => [
        code,
        readText(values, (part) => faqBaseField(part, code)),
      ]),
    ),
    fieldErrors: Object.fromEntries(
      inputs.flatMap((input) => input.fieldErrors),
    ),
  };
}

// Lo que está mal en el envío como un todo, cuando ningún campo lo está solo.
function findFormError(
  { texts }: Pick<FaqSubmission, "texts">,
  { defaultCode, isPublished }: SubmissionRules,
): "publishedNeedsDefault" | "noLanguage" | null {
  if (isPublished && texts[defaultCode] === undefined) {
    return "publishedNeedsDefault";
  }
  return Object.keys(texts).length === 0 ? "noLanguage" : null;
}

export function readFaqSubmission(
  formData: FormData,
  rules: SubmissionRules,
): FaqSubmission {
  const names = listFieldNames(rules);
  const values = readValues(formData, names);
  const translations = readTranslations(rules.codes, values);
  const submission = { values, ...translations };
  // Un campo que no llega no es un campo vacío: tomarlo así borraría su
  // traducción.
  if (Object.keys(values).length !== names.length) {
    return { ...submission, formError: "malformed" };
  }
  if (Object.keys(submission.fieldErrors).length > 0) {
    return { ...submission, formError: null };
  }
  const formError = findFormError(submission, rules);
  if (formError === null) return { ...submission, formError };
  const fieldErrors = requireDefault(rules.defaultCode);
  return { ...submission, fieldErrors, formError };
}
