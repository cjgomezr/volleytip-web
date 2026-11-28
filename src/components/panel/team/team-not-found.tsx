import type { ReactElement } from "react";
import { Link } from "react-router";

import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { CARD_STYLES, TEXT_LINK_STYLES } from "../messages/message-styles";
import { PanelHeading } from "../panel-heading";

/**
 * El 404 de alguien que no está en el equipo, dentro de la cáscara. Lo elige
 * el límite de `shell-layout.tsx`; los demás fallos del equipo usan la
 * pantalla de fallo del panel.
 */
export function TeamNotFound(): ReactElement {
  const translate = useTranslate();
  const listPath = getPanelPath("adminTeam", useLanguage());
  return (
    <div className="max-w-[640px]">
      <PanelHeading
        title={translate("panel.team.notFound.title")}
        isLongTitle
      />
      <div className={`mt-5 ${CARD_STYLES}`}>
        <p className="m-0 leading-[1.5]">
          {translate("panel.team.notFound.details")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6">
          <Link to={listPath} className={TEXT_LINK_STYLES}>
            {translate("panel.team.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
