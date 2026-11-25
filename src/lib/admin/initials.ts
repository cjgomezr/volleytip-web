const MAX_INITIALS = 2;
const WHITESPACE = /\s+/;

/** Las iniciales del círculo de quien entró. De un correo sale una sola. */
export function getInitials(displayName: string): string {
  return displayName
    .trim()
    .split(WHITESPACE)
    .slice(0, MAX_INITIALS)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}
