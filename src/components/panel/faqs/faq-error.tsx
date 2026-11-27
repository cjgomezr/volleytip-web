import type { ReactElement } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { useReferenceCode } from "~/lib/error-reference";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { CARD_STYLES, TEXT_LINK_STYLES } from "../messages/message-styles";
import { PanelHeading } from "../panel-heading";

const NOT_FOUND_STATUS = 404;

/**
 * Lo que pinta una ruta de las preguntas cuando falla, dentro de la cáscara:
 * el 404 de una pregunta que no existe, o un cambio que no se pudo completar
 * (por ejemplo, si la bitácora falló).
 */
export function FaqErrorBoundary(): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const error = useRouteError();
  const referenceCode = useReferenceCode();
  const isMissing =
    isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS;
  const listPath = getPanelPath("adminFaqs", language);
  return (
    <div className="max-w-[640px]">
      <PanelHeading
        title={translate(
          isMissing ? "panel.faqs.notFound.title" : "panel.faqs.failure.title",
        )}
        isLongTitle
      />
      <div className={`mt-5 ${CARD_STYLES}`}>
        <p role={isMissing ? undefined : "alert"} className="m-0 leading-[1.5]">
          {translate(
            isMissing
              ? "panel.faqs.notFound.details"
              : "panel.faqs.failure.details",
          )}
        </p>
        {isMissing ? null : (
          // Como en la página 500: el servidor lo pinta y el navegador, que
          // no lo conoce, lo conserva. Vacío, el párrafo se oculta.
          <p className="mt-3 mb-0 text-[14px] text-ink-subtle has-[strong:empty]:hidden">
            {ERROR_MESSAGES[language]["error.serverReference"]}:{" "}
            <strong suppressHydrationWarning>{referenceCode ?? ""}</strong>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-6">
          {isMissing ? null : (
            // Recarga el documento: así se vuelve a pedir todo al servidor.
            <Link to={listPath} reloadDocument className={TEXT_LINK_STYLES}>
              {translate("panel.faqs.failure.retry")}
            </Link>
          )}
          <Link to={listPath} className={TEXT_LINK_STYLES}>
            {translate("panel.faqs.editor.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
