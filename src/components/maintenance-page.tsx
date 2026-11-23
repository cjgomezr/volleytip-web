import type { ReactElement } from "react";

import {
  OUTLINE_INTERACTIVE_STYLES,
  OUTLINE_ZONE_STYLES,
  TRANSITION_STYLES,
} from "~/components/pressable-styles";
import { formatDate } from "~/lib/i18n/format";
import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { useLanguage } from "~/lib/i18n/use-language";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "~/lib/social-links";

const WORDMARK_WIDTH = 312;
const WORDMARK_HEIGHT = 59;

// En el orden del mockup. La primera es la acción principal.
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

const BADGE_STYLES =
  "m-0 rounded-pill bg-brand-lime px-3 py-1 text-[12px] font-bold tracking-[0.12em] text-brand-night uppercase";
const TITLE_STYLES =
  "mt-4 font-display text-[56px] leading-[0.9] uppercase md:text-[112px]";
const TEXT_STYLES = "max-w-[48ch] text-[16px] leading-[1.5]";
// Son enlaces a otro sitio, así que no pueden ser el `Button` del sistema,
// que solo enlaza páginas del mapa. Llevan sus mismas medidas y estados.
const NETWORK_LINK_STYLES = `inline-flex min-h-11 items-center justify-center rounded-pill px-6 py-2 text-[16px] leading-tight font-bold no-underline ${TRANSITION_STYLES}`;
const MAIN_NETWORK_STYLES = `${NETWORK_LINK_STYLES} border-2 border-brand-red bg-brand-red text-brand-night hovered:border-brand-lime hovered:bg-brand-lime pressed:border-brand-mist pressed:bg-brand-mist`;
const OTHER_NETWORK_STYLES = `${NETWORK_LINK_STYLES} border-2 bg-transparent ${OUTLINE_ZONE_STYLES.dark} ${OUTLINE_INTERACTIVE_STYLES.dark}`;

function findNetworkHref(id: SocialNetworkId): string {
  const network = SOCIAL_NETWORKS.find((candidate) => candidate.id === id);
  if (network === undefined) {
    throw new Error(`La red "${id}" no está en las direcciones del sitio.`);
  }
  return network.href;
}

function NetworkLinks({ label }: { readonly label: string }): ReactElement {
  const [mainNetwork] = MAINTENANCE_NETWORKS;
  return (
    <nav aria-label={label} className="mt-8">
      <ul className="m-0 flex list-none flex-wrap justify-center gap-3 p-0">
        {MAINTENANCE_NETWORKS.map((id) => (
          <li key={id}>
            <a
              href={findNetworkHref(id)}
              rel="noopener noreferrer"
              className={
                id === mainNetwork ? MAIN_NETWORK_STYLES : OTHER_NETWORK_STYLES
              }
            >
              {NETWORK_NAMES[id]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * La página del modo mantenimiento (`docs/mockups/Errores.png`, franja
 * "Mantenimiento"). No lleva header, pie ni barra: no lee la base y sus textos
 * viajan siempre con el código, como los de los errores.
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
    <main className="flex min-h-screen flex-col items-center bg-brand-indigo px-6 py-8 text-center">
      <title>{messages["maintenance.title"]}</title>
      <meta name="robots" content="noindex, nofollow" />
      <img
        src="/brand/wordmark.png"
        alt={messages["maintenance.logoLabel"]}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        className="h-[30px] w-auto"
      />
      <div className="my-auto flex flex-col items-center py-12">
        <p className={BADGE_STYLES}>{messages["maintenance.badge"]}</p>
        <h1 className={TITLE_STYLES}>
          <span className="block">{messages["maintenance.titleStart"]}</span>
          {/* El espacio no se ve entre dos bloques, pero el lector de pantalla
              y quien copie el texto leen dos palabras y no una. */}{" "}
          <span className="block text-brand-red">
            {messages["maintenance.titleAccent"]}
          </span>
        </h1>
        <p className={`mt-6 ${TEXT_STYLES}`}>
          {messages["maintenance.details"]}
        </p>
        {returnsAt === null ? null : (
          <p className={`mt-2 font-bold ${TEXT_STYLES}`}>
            {messages["maintenance.returnsAt"].replace(
              "{time}",
              formatDate(new Date(returnsAt), language, {
                style: "long",
                withTime: true,
              }),
            )}
          </p>
        )}
        <NetworkLinks label={messages["maintenance.socialLabel"]} />
      </div>
    </main>
  );
}
