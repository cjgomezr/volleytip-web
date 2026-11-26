import type { ReactElement } from "react";
import {
  isRouteErrorResponse,
  Link,
  useParams,
  useRouteError,
} from "react-router";

import { useReferenceCode } from "~/lib/error-reference";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { PanelHeading } from "../panel-heading";
import { CARD_STYLES, TEXT_LINK_STYLES } from "./message-styles";

const NOT_FOUND_STATUS = 404;

/**
 * Lo que pinta una ruta de un mensaje cuando falla, dentro de la cáscara: el
 * 404 de un mensaje que no existe, o un cambio que no se pudo completar (por
 * ejemplo, si la bitácora falló).
 */
export function MessageErrorBoundary(): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const error = useRouteError();
  const { messageId } = useParams();
  const referenceCode = useReferenceCode();
  const isMissing =
    isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS;
  const retryPath =
    isMissing || messageId === undefined
      ? null
      : getPanelPath("adminMessage", language, { messageId });
  return (
    <div className="max-w-[640px]">
      <PanelHeading
        title={translate(
          isMissing
            ? "panel.messages.notFound.title"
            : "panel.messages.failure.title",
        )}
        isLongTitle
      />
      <div className={`mt-5 ${CARD_STYLES}`}>
        <p role={isMissing ? undefined : "alert"} className="m-0 leading-[1.5]">
          {translate(
            isMissing
              ? "panel.messages.notFound.details"
              : "panel.messages.failure.details",
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
          {retryPath === null ? null : (
            // Recarga el documento: así se vuelve a pedir todo al servidor.
            <Link to={retryPath} reloadDocument className={TEXT_LINK_STYLES}>
              {translate("panel.messages.failure.retry")}
            </Link>
          )}
          <Link
            to={getPanelPath("adminMessages", language)}
            className={TEXT_LINK_STYLES}
          >
            {translate("panel.messages.detail.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
