import type { ReactElement, ReactNode } from "react";

import type { FieldError } from "~/lib/admin/site-texts";
import { useTranslate } from "~/lib/i18n/translations-context";

import { Button } from "../button";

/** Una tarjeta de "Textos del sitio": un formulario con su título. */
export function EditorSection({
  id,
  title,
  intro,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section
      aria-labelledby={id}
      className="mt-6 rounded-card bg-surface-light p-4 md:p-6"
    >
      <h2
        id={id}
        className="m-0 font-display text-[28px] leading-[0.95] uppercase"
      >
        {title}
      </h2>
      <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-ink-subtle">
        {intro}
      </p>
      {children}
    </section>
  );
}

/** El texto del error de un campo, o nada si no tiene. */
export function useFieldErrorText(): (
  error: FieldError | undefined,
  maxLength: number,
) => string | undefined {
  const translate = useTranslate();
  return (error, maxLength) => {
    if (error === undefined) return undefined;
    return error === "required"
      ? translate("panel.siteTexts.error.required")
      : translate("panel.siteTexts.maxLength", { max: maxLength });
  };
}

interface SaveBarProps {
  readonly submitLabel: string;
  readonly isSaving: boolean;
  /** Se cambió algo después del último envío: la confirmación ya no vale. */
  readonly isEdited: boolean;
  /** Cómo terminó el último envío; ausente si no ha habido ninguno. */
  readonly status: "saved" | "unchanged" | "invalid" | undefined;
  /** El error que no es de ningún campo. */
  readonly formError?: string;
}

/**
 * El pie de un formulario: su botón y lo que pasó al guardar. Mientras envía
 * no muestra el resultado anterior, así un lector de pantalla vuelve a
 * anunciar el nuevo aunque diga lo mismo.
 */
export function SaveBar({
  submitLabel,
  isSaving,
  isEdited,
  status,
  formError,
}: SaveBarProps): ReactElement {
  const translate = useTranslate();
  const result = isSaving ? undefined : status;
  return (
    <div className="mt-5 flex flex-col items-start gap-3">
      {result === "invalid" ? (
        <p
          role="alert"
          className="m-0 text-[15px] leading-[1.5] font-bold text-brand-red-deep"
        >
          {translate("panel.siteTexts.error.summary")}
          {formError === undefined ? null : (
            <span className="block">{formError}</span>
          )}
        </p>
      ) : null}
      <Button
        type="submit"
        zone="light"
        submittingLabel={
          isSaving ? translate("panel.siteTexts.saving") : undefined
        }
      >
        {submitLabel}
      </Button>
      {/* La región existe siempre: un lector de pantalla solo anuncia lo que
          cambia dentro de una región que ya estaba en la página. */}
      <div role="status">
        {!isEdited && (result === "saved" || result === "unchanged") ? (
          <p className="m-0 flex items-center gap-2 rounded-pill bg-brand-lime px-4 py-2 text-[15px] font-bold text-brand-night">
            <span aria-hidden="true">✓</span>
            {result === "saved"
              ? translate("panel.siteTexts.saved")
              : translate("panel.siteTexts.unchanged")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
