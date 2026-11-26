import type { ReactElement } from "react";

import type { LocalizedDraft } from "~/lib/admin/site-texts";
import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";

import { Button } from "../button";
import { TextField } from "../text-field";

/** Un mensaje mientras se edita. El id lo sigue al reordenar. */
export type MessageRow = LocalizedDraft & { readonly id: number };

export type RowAction = "up" | "down" | "remove";

interface MessageFieldsProps {
  readonly row: MessageRow;
  /** Su lugar en la barra, desde 1. */
  readonly number: number;
  readonly isLast: boolean;
  readonly errors: Partial<Record<Language, string>>;
  readonly onChange: (language: Language, text: string) => void;
  readonly onAction: (action: RowAction) => void;
}

function RowButtons({
  number,
  isLast,
  onAction,
}: Pick<MessageFieldsProps, "number" | "isLast" | "onAction">): ReactElement {
  const translate = useTranslate();
  const buttons = [
    {
      action: "up",
      isDisabled: number === 1,
      text: translate("panel.siteTexts.bar.up"),
      label: translate("panel.siteTexts.bar.upLabel", { number }),
    },
    {
      action: "down",
      isDisabled: isLast,
      text: translate("panel.siteTexts.bar.down"),
      label: translate("panel.siteTexts.bar.downLabel", { number }),
    },
    {
      action: "remove",
      isDisabled: false,
      text: translate("panel.siteTexts.bar.remove"),
      label: translate("panel.siteTexts.bar.removeLabel", { number }),
    },
  ] as const;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {buttons.map(({ action, isDisabled, text, label }) => (
        <span key={action} data-row-action={action} className="inline-flex">
          <Button
            variant="secondary"
            zone="light"
            aria-label={label}
            isDisabled={isDisabled}
            onClick={() => onAction(action)}
          >
            {text}
          </Button>
        </span>
      ))}
    </div>
  );
}

/** Los campos de un mensaje de la barra, con los botones para moverlo. */
export function AnnouncementMessageFields({
  row,
  number,
  isLast,
  errors,
  onChange,
  onAction,
}: MessageFieldsProps): ReactElement {
  const translate = useTranslate();
  const isMissingEnglish = row.es.trim() !== "" && row.en.trim() === "";
  return (
    <fieldset
      data-message-row={row.id}
      className="m-0 min-w-0 rounded-card border-2 border-line-light p-3 md:p-4"
    >
      <legend className="px-1 text-[13px] font-bold tracking-[0.08em] uppercase">
        {translate("panel.siteTexts.bar.message", { number })}
      </legend>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          zone="light"
          name="es"
          label={translate("panel.siteTexts.bar.textEs")}
          defaultValue={row.es}
          error={errors.es}
          onChange={(text) => onChange("es", text)}
        />
        <TextField
          zone="light"
          name="en"
          label={translate("panel.siteTexts.bar.textEn")}
          defaultValue={row.en}
          error={errors.en}
          hint={
            isMissingEnglish
              ? translate("panel.siteTexts.bar.missingEnglish")
              : undefined
          }
          onChange={(text) => onChange("en", text)}
        />
      </div>
      <RowButtons number={number} isLast={isLast} onAction={onAction} />
    </fieldset>
  );
}
