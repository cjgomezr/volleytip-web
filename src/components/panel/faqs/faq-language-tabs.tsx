import { useState, type KeyboardEvent, type ReactElement } from "react";

import {
  faqBaseField,
  faqField,
  type FaqEditorView,
  type FaqLanguage,
  type FaqPart,
  type FaqSaveOutcome,
} from "~/lib/admin/faqs";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useIsHydrated } from "~/lib/use-is-hydrated";

import { TRANSITION_STYLES } from "../../pressable-styles";
import { TextAreaField } from "../../text-area-field";
import { TextField } from "../../text-field";
import { useSyncedFields } from "./use-synced-fields";

type Rejection = Extract<FaqSaveOutcome, { status: "invalid" }>;

const ANSWER_ROWS = 8;
const TAB_STYLES = `flex min-h-11 flex-col items-center justify-center rounded-pill border-2 border-brand-night px-5 py-1 text-center max-sm:w-full pressed:border-brand-indigo pressed:bg-brand-indigo pressed:text-brand-mist focused:outline-brand-night ${TRANSITION_STYLES}`;
const SELECTED_TAB_STYLES = "bg-brand-night text-brand-mist";
const IDLE_TAB_STYLES = "bg-transparent text-brand-night hovered:bg-line-light";

function tabId(code: string): string {
  return `faq-tab-${code}`;
}

function panelId(code: string): string {
  return `faq-panel-${code}`;
}

function hasErrors(code: string, rejected: Rejection | undefined): boolean {
  return (["question", "answer"] as const).some(
    (part) => rejected?.fieldErrors[faqField(part, code)] !== undefined,
  );
}

function firstWithErrors(
  languages: readonly FaqLanguage[],
  rejected: Rejection | undefined,
): string | undefined {
  return languages.find(({ code }) => hasErrors(code, rejected))?.code;
}

/** La pestaña elegida. Un envío rechazado abre la primera que tenga errores,
 * salvo que la elegida ya los tenga. */
function useSelectedTab(
  languages: readonly FaqLanguage[],
  rejected: Rejection | undefined,
): readonly [string, (code: string) => void] {
  const [selected, setSelected] = useState(
    () =>
      firstWithErrors(languages, rejected) ??
      languages.find(({ isDefault }) => isDefault)?.code ??
      "",
  );
  const [seen, setSeen] = useState(rejected);
  if (seen !== rejected) {
    setSeen(rejected);
    const wanted = firstWithErrors(languages, rejected);
    if (wanted !== undefined && !hasErrors(selected, rejected)) {
      setSelected(wanted);
    }
  }
  return [selected, setSelected];
}

// Las flechas, Inicio y Fin, como pide el patrón de pestañas de WAI-ARIA.
function findKeyTarget(key: string, index: number, count: number): number {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  return key === "End" ? count - 1 : -1;
}

interface TabListProps {
  readonly languages: readonly FaqLanguage[];
  readonly selected: string;
  readonly rejected: Rejection | undefined;
  readonly onSelect: (code: string) => void;
}

function TabList({
  languages,
  selected,
  rejected,
  onSelect,
}: TabListProps): ReactElement {
  const translate = useTranslate();
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    const target = languages[findKeyTarget(event.key, index, languages.length)];
    if (target === undefined) return;
    event.preventDefault();
    onSelect(target.code);
    document.getElementById(tabId(target.code))?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label={translate("panel.faqs.editor.tabs")}
      className="flex flex-wrap gap-2"
    >
      {languages.map(({ code, name, isTranslated }, index) => (
        <button
          key={code}
          id={tabId(code)}
          type="button"
          role="tab"
          aria-selected={code === selected}
          aria-controls={panelId(code)}
          tabIndex={code === selected ? 0 : -1}
          onClick={() => onSelect(code)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`${TAB_STYLES} ${code === selected ? SELECTED_TAB_STYLES : IDLE_TAB_STYLES}`}
        >
          <span className="text-[16px] font-bold">{name}</span>
          <span className="text-[12px]">
            <span aria-hidden="true">{isTranslated ? "✓ " : "— "}</span>
            {translate(
              isTranslated
                ? "panel.faqs.translated"
                : "panel.faqs.notTranslated",
            )}
            {hasErrors(code, rejected) ? (
              <>
                {" · "}
                <span aria-hidden="true">⚠ </span>
                {translate("panel.faqs.editor.hasErrors")}
              </>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

type FieldsProps = Pick<FaqEditorView, "texts" | "limits"> & {
  readonly language: FaqLanguage;
  readonly rejected: Rejection | undefined;
  readonly submitted: FormData | undefined;
};

function LanguageFields({
  language: { code, name },
  texts,
  limits,
  rejected,
  submitted,
}: FieldsProps): ReactElement {
  const translate = useTranslate();
  // Un envío rechazado sin JavaScript vuelve con la base que traía.
  const readInitialBase = (part: FaqPart): string =>
    rejected?.values[faqBaseField(part, code)] ?? texts[code]?.[part] ?? "";
  const { containerRef, base } = useSyncedFields({
    code,
    stored: texts[code],
    initialBase: {
      question: readInitialBase("question"),
      answer: readInitialBase("answer"),
    },
    submitted,
  });
  const limitText = (part: FaqPart): string =>
    translate("panel.siteTexts.maxLength", { max: limits[part] });
  function describe(part: FaqPart): {
    name: string;
    defaultValue: string;
    hint: string;
    error: string | undefined;
  } {
    const field = faqField(part, code);
    const error = rejected?.fieldErrors[field];
    return {
      name: field,
      defaultValue: rejected?.values[field] ?? texts[code]?.[part] ?? "",
      hint: limitText(part),
      error:
        error === "tooLong"
          ? translate("panel.faqs.error.tooLong", { max: limits[part] })
          : error && translate("panel.faqs.error.required"),
    };
  }
  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {(["question", "answer"] as const).map((part) => (
        // Con él el servidor sabe qué texto vio esta persona en el campo.
        <input
          key={part}
          type="hidden"
          name={faqBaseField(part, code)}
          value={base[part]}
        />
      ))}
      <TextField
        zone="light"
        label={translate("panel.faqs.editor.question", { language: name })}
        {...describe("question")}
      />
      <TextAreaField
        zone="light"
        rows={ANSWER_ROWS}
        label={translate("panel.faqs.editor.answer", { language: name })}
        {...describe("answer")}
      />
    </div>
  );
}

/**
 * Los campos de cada idioma activo, en pestañas. Sin JavaScript no hay quién
 * las cambie: se ven todos, uno debajo del otro. Los campos de una pestaña
 * oculta se envían igual.
 */
export function FaqLanguageTabs({
  languages,
  rejected,
  ...fields
}: Pick<FaqEditorView, "languages" | "texts" | "limits"> & {
  readonly rejected: Rejection | undefined;
  /** El envío en curso, si hay uno. */
  readonly submitted: FormData | undefined;
}): ReactElement {
  const isHydrated = useIsHydrated();
  const [selected, setSelected] = useSelectedTab(languages, rejected);
  return (
    <div className="mt-4">
      {isHydrated ? (
        <TabList
          languages={languages}
          selected={selected}
          rejected={rejected}
          onSelect={setSelected}
        />
      ) : null}
      {languages.map((language) => (
        <div
          key={language.code}
          id={panelId(language.code)}
          role={isHydrated ? "tabpanel" : undefined}
          aria-labelledby={isHydrated ? tabId(language.code) : undefined}
          hidden={isHydrated && language.code !== selected}
          className="mt-4"
        >
          {isHydrated ? null : (
            <h2 className="mt-0 mb-3 text-[13px] font-bold tracking-[0.08em] uppercase">
              {language.name}
            </h2>
          )}
          <LanguageFields language={language} rejected={rejected} {...fields} />
        </div>
      ))}
    </div>
  );
}
