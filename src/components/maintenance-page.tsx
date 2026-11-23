import type { ReactElement } from "react";

import { SocialIcon } from "~/components/social-icons";
import { TRANSITION_STYLES } from "~/components/pressable-styles";
import { formatDate } from "~/lib/i18n/format";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { useLanguage } from "~/lib/i18n/use-language";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "~/lib/social-links";

const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

const MAINTENANCE_NETWORKS: readonly SocialNetworkId[] = [
  "instagram",
  "tiktok",
  "youtube",
];
const NETWORK_NAMES: Readonly<Record<SocialNetworkId, string>> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

const TITLE_STYLES =
  "mt-8 font-display text-[40px] leading-[1.05] uppercase md:text-[72px]";
const SOCIAL_LINK_STYLES = `inline-flex size-11 items-center justify-center rounded-pill text-brand-mist no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;

/**
 * La página del modo mantenimiento. No lleva header, pie ni barra: no lee la
 * base y sus textos viajan siempre con el código, como los de los errores.
 * `returnsAt` es la hora de regreso que sigue en el futuro, o `null`.
 */
export function MaintenancePage({
  returnsAt,
}: {
  readonly returnsAt: string | null;
}): ReactElement {
  const language = useLanguage();
  const messages = ERROR_MESSAGES[language];
  return (
    <main className="mx-auto flex min-h-screen max-w-[1280px] flex-col items-start justify-center px-6 py-12">
      <title>{messages["maintenance.title"]}</title>
      <meta name="robots" content="noindex, nofollow" />
      <img
        src="/brand/wordmark.png"
        alt={messages["maintenance.logoLabel"]}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        className="h-[30px] w-auto"
      />
      <h1 className={TITLE_STYLES}>{messages["maintenance.title"]}</h1>
      <p className="mt-6 max-w-[56ch] text-[16px] leading-[1.5] text-ink-muted">
        {messages["maintenance.details"]}
      </p>
      {returnsAt === null ? null : (
        <p className="mt-2 max-w-[56ch] text-[16px] leading-[1.5] font-bold">
          {messages["maintenance.returnsAt"].replace(
            "{time}",
            formatDate(new Date(returnsAt), language, {
              style: "long",
              withTime: true,
            }),
          )}
        </p>
      )}
      <nav aria-label={messages["maintenance.socialLabel"]} className="mt-8">
        <ul className="m-0 flex list-none gap-2 p-0">
          {SOCIAL_NETWORKS.filter(({ id }) =>
            MAINTENANCE_NETWORKS.includes(id),
          ).map(({ id, href }) => (
            <li key={id}>
              <a
                href={href}
                aria-label={NETWORK_NAMES[id]}
                rel="noopener noreferrer"
                className={SOCIAL_LINK_STYLES}
              >
                <SocialIcon network={id} />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
