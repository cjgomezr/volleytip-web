import { expect, it } from "vitest";

import { describeIntegrationAgainst } from "../describe-integration";

// El puerto 1 (tcpmux) no lo escucha nadie: la conexión se rechaza siempre,
// esté o no arriba la base local.
const UNREACHABLE_DATABASE = {
  host: "127.0.0.1",
  port: 1,
  timeoutMs: 500,
} as const;

// No es un test de la suite: lo corre describe-integration.test.ts en un
// Vitest aparte para ver qué hace el ayudante con la base apagada.
describeIntegrationAgainst(UNREACHABLE_DATABASE, "base inalcanzable", () => {
  it("no llega a correr", () => {
    expect.unreachable("el bloque debió fallar antes, en la comprobación");
  });
});
