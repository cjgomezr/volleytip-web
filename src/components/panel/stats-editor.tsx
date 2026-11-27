import { useState, type ReactElement } from "react";

import {
  SITE_STAT_NAME_KEYS,
  statField,
  type SiteStatDraft,
  type SiteStatPart,
  type SiteTextsLimits,
  type StatsOutcome,
} from "~/lib/admin/site-texts";
import type { Language } from "~/lib/i18n/languages";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { TextField } from "../text-field";
import { EditorSection, SaveBar, useFieldErrorText } from "./editor-section";
import { PreloadSubmission } from "./preload-submission";

const STAT_INPUTS: readonly {
  readonly part: SiteStatPart;
  readonly language: Language;
  readonly labelKey: MessageKey;
}[] = [
  { part: "value", language: "es", labelKey: "panel.siteTexts.stats.valueEs" },
  { part: "value", language: "en", labelKey: "panel.siteTexts.stats.valueEn" },
  { part: "label", language: "es", labelKey: "panel.siteTexts.stats.labelEs" },
  { part: "label", language: "en", labelKey: "panel.siteTexts.stats.labelEn" },
];

function StatFields({
  stat,
  limits,
  outcome,
}: {
  readonly stat: SiteStatDraft;
  readonly limits: SiteTextsLimits;
  readonly outcome: StatsOutcome | undefined;
}): ReactElement {
  const translate = useTranslate();
  const errorText = useFieldErrorText();
  const rejected = outcome?.status === "invalid" ? outcome : undefined;
  const maxLengths = {
    value: limits.maxStatValueLength,
    label: limits.maxStatLabelLength,
  };
  return (
    <fieldset className="m-0 min-w-0 rounded-card border-2 border-line-light p-3 md:p-4">
      <legend className="px-1 text-[13px] font-bold tracking-[0.08em] uppercase">
        {translate(SITE_STAT_NAME_KEYS[stat.id])}
      </legend>
      <div className="grid gap-4 lg:grid-cols-2">
        {STAT_INPUTS.map(({ part, language, labelKey }) => {
          const name = statField(stat.id, part, language);
          return (
            <TextField
              key={name}
              zone="light"
              name={name}
              label={translate(labelKey)}
              defaultValue={rejected?.values[name] ?? stat[part][language]}
              error={errorText(rejected?.fieldErrors[name], maxLengths[part])}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

/** Las cifras de la home: el valor y la etiqueta de cada una, por idioma. */
export function StatsEditor({
  stats,
  limits,
  initialOutcome,
}: {
  readonly stats: readonly SiteStatDraft[];
  readonly limits: SiteTextsLimits;
  /** La respuesta de un envío sin JavaScript. */
  readonly initialOutcome?: StatsOutcome;
}): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const fetcher = usePanelFetcher<StatsOutcome>(initialOutcome);
  const { outcome } = fetcher;
  const [isEdited, setIsEdited] = useState(false);
  const action = getPanelPath("adminSiteTextsStats", language);
  const isMalformed =
    outcome?.status === "invalid" && outcome.formError === "malformed";
  const intro = translate("panel.siteTexts.stats.intro", {
    value: limits.maxStatValueLength,
    label: limits.maxStatLabelLength,
  });
  return (
    <EditorSection
      id="site-texts-stats"
      title={translate("panel.siteTexts.stats.title")}
      intro={intro}
    >
      <fetcher.Form
        method="post"
        action={action}
        noValidate
        onInput={() => setIsEdited(true)}
        onSubmit={() => setIsEdited(false)}
      >
        <PreloadSubmission action={action} />
        <div className="mt-4 flex flex-col gap-4">
          {stats.map((stat) => (
            <StatFields
              key={stat.id}
              stat={stat}
              limits={limits}
              outcome={outcome}
            />
          ))}
        </div>
        <SaveBar
          submitLabel={translate("panel.siteTexts.stats.save")}
          isSaving={fetcher.isSending}
          isEdited={isEdited}
          status={outcome?.status}
          isUnsent={fetcher.isUnsent}
          formError={
            isMalformed
              ? translate("panel.siteTexts.error.malformed")
              : undefined
          }
        />
      </fetcher.Form>
    </EditorSection>
  );
}
