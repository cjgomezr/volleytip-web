import type { ReactElement } from "react";
import { Link } from "react-router";

import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { CARD_STYLES, TEXT_LINK_STYLES } from "../messages/message-styles";
import { PanelHeading } from "../panel-heading";

/**
 * El 404 de una pregunta que no existe, dentro de la cáscara. Lo elige el
 * límite de `shell-layout.tsx`; los demás fallos de las preguntas usan la
 * pantalla de fallo del panel.
 */
export function FaqNotFound(): ReactElement {
  const translate = useTranslate();
  const listPath = getPanelPath("adminFaqs", useLanguage());
  return (
    <div className="max-w-[640px]">
      <PanelHeading
        title={translate("panel.faqs.notFound.title")}
        isLongTitle
      />
      <div className={`mt-5 ${CARD_STYLES}`}>
        <p className="m-0 leading-[1.5]">
          {translate("panel.faqs.notFound.details")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6">
          <Link to={listPath} className={TEXT_LINK_STYLES}>
            {translate("panel.faqs.editor.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
