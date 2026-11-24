import { SOCIAL_NETWORKS } from "./social-links";

/** Los canales directos de VolleyTip (FR-003). El formulario los ofrece al
 * lado y cuando rechaza un envío. */
export const WHATSAPP_DISPLAY_NUMBER = "+57 314 648 6275";
export const TEAM_EMAIL = "team@volleytip.com";
export const TEAM_EMAIL_HREF = `mailto:${TEAM_EMAIL}`;

const whatsapp = SOCIAL_NETWORKS.find(({ id }) => id === "whatsapp");
if (whatsapp === undefined) {
  throw new Error("Falta WhatsApp en las redes de VolleyTip.");
}
export const WHATSAPP_HREF: string = whatsapp.href;
