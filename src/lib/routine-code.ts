// El código de un enlace compartido de rutina (`/r/<código>`). La web no lo
// guarda ni lo busca en ninguna tabla: solo evita que la dirección lleve
// cualquier cosa.
export const MAX_ROUTINE_CODE_LENGTH = 64;

const ROUTINE_CODE_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{1,${String(MAX_ROUTINE_CODE_LENGTH)}}$`,
);

export function isRoutineCode(value: string): boolean {
  return ROUTINE_CODE_PATTERN.test(value);
}
