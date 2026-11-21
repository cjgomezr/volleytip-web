import { describe, expect, it } from "vitest";

import type { TranslateFor } from "./translate";

interface Catalog {
  readonly plain: "Hola";
  readonly greeting: "Hola {name}, tienes {unread} avisos";
  readonly seats: {
    readonly one: "{count} cupo";
    readonly other: "{count} cupos";
  };
}

declare const t: TranslateFor<Catalog>;

// Estas comprobaciones las hace el compilador (`npm run typecheck`): si una
// directiva `@ts-expect-error` deja de ser necesaria, el typecheck falla.
function compileTimeChecks(): void {
  t("plain");
  t("greeting", { name: "Ana", unread: 3 });
  t("seats", { count: 2 });
  // @ts-expect-error la clave no existe
  t("missing");
  // @ts-expect-error falta la variable "unread"
  t("greeting", { name: "Ana" });
  // @ts-expect-error sobra la variable "extra"
  t("greeting", { name: "Ana", unread: 1, extra: 1 });
  // @ts-expect-error el texto sin variables no recibe valores
  t("plain", { name: "Ana" });
  // @ts-expect-error count es un número
  t("seats", { count: "2" });
}

describe("textos: tipos", () => {
  it("el compilador rechaza claves y variables que no coinciden", () => {
    expect(compileTimeChecks).toBeTypeOf("function");
  });
});
