/** Lo que la vuelta de Google le dice a la pantalla de entrada. */
const GOOGLE_NOTICES = ["denied", "failed"] as const;

export type GoogleNotice = (typeof GOOGLE_NOTICES)[number];

/** El parámetro de la pantalla de entrada con ese aviso. */
export const GOOGLE_NOTICE_PARAM = "google";

/** El parámetro viene de la dirección: solo se leen los avisos conocidos. */
export function readGoogleNotice(value: string | null): GoogleNotice | null {
  return GOOGLE_NOTICES.find((notice) => notice === value) ?? null;
}
