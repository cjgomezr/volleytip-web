import type { PostgrestError } from "@supabase/supabase-js";

// El código de Postgres de una regla `check` que no se cumple.
const CHECK_VIOLATION = "23514";

/** Cuál de esas reglas de la base rechazó la escritura, o `undefined` si el
 * fallo es otro. El nombre de la regla viaja en el mensaje. */
export function findBrokenRule<Rule extends string>(
  error: Pick<PostgrestError, "code" | "message">,
  rules: readonly Rule[],
): Rule | undefined {
  if (error.code !== CHECK_VIOLATION) return undefined;
  return rules.find((rule) => error.message.includes(rule));
}
