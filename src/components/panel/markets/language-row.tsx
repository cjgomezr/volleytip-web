import type { ReactElement } from "react";
import { useFetcher } from "react-router";

import {
  MARKETS_FIELDS,
  type LanguageOutcome,
  type PanelLanguage,
} from "~/lib/admin/markets";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { Button } from "../../button";
import { StatePill } from "./state-pill";

// Lo que dice el botón y lo que oye un lector de pantalla, según lo que hará.
const TOGGLE_KEYS = {
  deactivate: {
    textKey: "panel.markets.languages.deactivate",
    labelKey: "panel.markets.languages.deactivateLabel",
  },
  activate: {
    textKey: "panel.markets.languages.activate",
    labelKey: "panel.markets.languages.activateLabel",
  },
} as const satisfies Readonly<
  Record<string, { textKey: MessageKey; labelKey: MessageKey }>
>;

function LanguageToggle({
  language,
  initialOutcome,
}: {
  readonly language: PanelLanguage;
  readonly initialOutcome: LanguageOutcome | undefined;
}): ReactElement {
  const translate = useTranslate();
  const path = getPanelPath("adminMarketsLanguage", useLanguage());
  const fetcher = useFetcher<LanguageOutcome>();
  const outcome = fetcher.data ?? initialOutcome;
  const isSaving = fetcher.state !== "idle";
  const { code, name, isActive } = language;
  const keys = TOGGLE_KEYS[isActive ? "deactivate" : "activate"];
  return (
    <>
      <fetcher.Form method="post" action={path}>
        <input type="hidden" name={MARKETS_FIELDS.code} value={code} />
        <input
          type="hidden"
          name={MARKETS_FIELDS.isActive}
          value={String(!isActive)}
        />
        <Button
          type="submit"
          zone="light"
          variant="secondary"
          submittingLabel={
            isSaving ? translate("panel.siteTexts.saving") : undefined
          }
        >
          <span aria-hidden="true">{translate(keys.textKey)}</span>
          <span className="sr-only">
            {translate(keys.labelKey, {
              language: name,
            })}
          </span>
        </Button>
      </fetcher.Form>
      {outcome?.status === "invalid" && !isSaving ? (
        <LanguageError error={outcome.error} />
      ) : null}
    </>
  );
}

function LanguageError({
  error,
}: {
  readonly error: "defaultLanguage" | "malformed";
}): ReactElement {
  const translate = useTranslate();
  return (
    <p
      role="alert"
      className="m-0 w-full text-[14px] font-semibold text-brand-red-deep"
    >
      {translate(
        error === "defaultLanguage"
          ? "panel.markets.error.defaultLanguage"
          : "panel.markets.error.languageMalformed",
      )}
    </p>
  );
}

/** Un idioma con su estado. El de por defecto no tiene botón: dice por qué. */
export function LanguageRow({
  language,
  initialOutcome,
}: {
  readonly language: PanelLanguage;
  readonly initialOutcome?: LanguageOutcome;
}): ReactElement {
  const translate = useTranslate();
  const { code, name, isDefault, isActive } = language;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-line-light p-3 md:p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span lang={code} className="text-[17px] font-bold break-words">
          {name}
        </span>
        <StatePill isActive={isActive} />
        {isDefault ? (
          <span className="rounded-pill bg-brand-night px-3 py-1 text-[13px] font-bold text-brand-mist">
            {translate("panel.markets.languages.default")}
          </span>
        ) : null}
      </div>
      {isDefault ? (
        <>
          <p className="m-0 w-full text-[14px] text-ink-subtle">
            {translate("panel.markets.languages.defaultReason")}
          </p>
          {initialOutcome?.status === "invalid" ? (
            <LanguageError error={initialOutcome.error} />
          ) : null}
        </>
      ) : (
        <LanguageToggle language={language} initialOutcome={initialOutcome} />
      )}
    </li>
  );
}
