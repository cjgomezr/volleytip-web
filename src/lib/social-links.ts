// Las direcciones de las redes de VolleyTip, en un solo lugar: el pie las
// toma de aquí y el menú de celular también.
export const TIKTOK_URL = "https://www.tiktok.com/@volleytip";

export const SOCIAL_NETWORKS = [
  { id: "tiktok", href: TIKTOK_URL },
  { id: "instagram", href: "https://www.instagram.com/volleytip/" },
  { id: "youtube", href: "https://www.youtube.com/@volleytip" },
  { id: "facebook", href: "https://www.facebook.com/volleytip/" },
  // El número de FR-003.
  { id: "whatsapp", href: "https://wa.me/573146486275" },
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];
