import type { ReactElement } from "react";
import { Link, useLocation } from "react-router";

import { useReferenceCode } from "~/lib/error-reference";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { getFailureReturnPath } from "~/lib/panel/failure-return-path";
import { isConnectionFailure } from "~/lib/panel/unsent-submission";

import { CARD_STYLES, TEXT_LINK_STYLES } from "./messages/message-styles";
import { PanelHeading } from "./panel-heading";

/** El código del registro. El servidor lo pinta y el navegador, que no lo
 * conoce, lo conserva. Vacío, el párrafo se oculta. */
function ReferenceCode(): ReactElement {
  const language = useLanguage();
  const referenceCode = useReferenceCode();
  return (
    <p className="mt-3 mb-0 text-[14px] text-ink-subtle has-[strong:empty]:hidden">
      {ERROR_MESSAGES[language]["error.serverReference"]}:{" "}
      <strong suppressHydrationWarning>{referenceCode ?? ""}</strong>
    </p>
  );
}

/**
 * La pantalla de un fallo inesperado del panel. No lee nada de la base: se
 * pinta aunque eso sea lo que falló. Sin conexión no dice que el fallo quedó
 * registrado, porque el servidor no se enteró.
 */
export function PanelFailure({
  error,
}: {
  readonly error: unknown;
}): ReactElement {
  const translate = useTranslate();
  const returnPath = getFailureReturnPath(useLocation());
  const isOffline = isConnectionFailure(error);
  return (
    <div data-panel-failure className="max-w-[640px]">
      <PanelHeading
        title={translate(
          isOffline ? "panel.failure.offlineTitle" : "panel.failure.title",
        )}
        isLongTitle
      />
      <div className={`mt-5 ${CARD_STYLES}`}>
        <p role="alert" className="m-0 leading-[1.5]">
          {translate(
            isOffline
              ? "panel.failure.offlineDetails"
              : "panel.failure.details",
          )}
        </p>
        {isOffline ? null : <ReferenceCode />}
        <div className="mt-2">
          {/* Recarga el documento: así se vuelve a pedir todo al servidor. */}
          <Link to={returnPath} reloadDocument className={TEXT_LINK_STYLES}>
            {translate("panel.failure.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
