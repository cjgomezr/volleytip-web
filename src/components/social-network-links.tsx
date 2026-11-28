import type { ReactElement } from "react";

import {
  OUTLINE_INTERACTIVE_STYLES,
  OUTLINE_ZONE_STYLES,
  TRANSITION_STYLES,
} from "~/components/pressable-styles";
import { SocialIcon } from "~/components/social-icons";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "~/lib/social-links";

// Las redes donde se publica contenido, las de los mockups. WhatsApp es solo
// del pie.
const CONTENT_NETWORK_LABEL_KEYS: Readonly<
  Partial<Record<SocialNetworkId, MessageKey>>
> = {
  tiktok: "footer.social.tiktok",
  instagram: "footer.social.instagram",
  youtube: "footer.social.youtube",
  facebook: "footer.social.facebook",
};

const NETWORK_LINK_STYLES = `inline-flex size-11 shrink-0 items-center justify-center rounded-pill border-2 bg-transparent no-underline ${OUTLINE_ZONE_STYLES.dark} ${OUTLINE_INTERACTIVE_STYLES.dark} ${TRANSITION_STYLES}`;

/** Los botones redondos a las redes de VolleyTip, en zona oscura. */
export function SocialNetworkLinks(): ReactElement {
  const translate = useTranslate();
  return (
    <ul
      aria-label={translate("footer.social.label")}
      className="m-0 flex list-none gap-3 p-0"
    >
      {SOCIAL_NETWORKS.map(({ id, href }) => {
        const labelKey = CONTENT_NETWORK_LABEL_KEYS[id];
        if (labelKey === undefined) {
          return null;
        }
        return (
          <li key={id}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={translate(labelKey)}
              className={NETWORK_LINK_STYLES}
            >
              <SocialIcon network={id} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
