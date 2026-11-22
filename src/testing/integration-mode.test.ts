import { describe, expect, it } from "vitest";

import {
  resolveIntegrationMode,
  allowsParallelFiles,
} from "./integration-mode";

describe("pruebas de integración", () => {
  it("se saltan cuando RUN_INTEGRATION_TESTS no está definida", () => {
    expect(resolveIntegrationMode(undefined)).toBe("skip");
  });

  it("se saltan cuando RUN_INTEGRATION_TESTS llega vacía, como en un PR de solo texto", () => {
    expect(resolveIntegrationMode("")).toBe("skip");
  });

  it("corren cuando RUN_INTEGRATION_TESTS vale 1", () => {
    expect(resolveIntegrationMode("1")).toBe("run");
  });

  it.each(["0", "true", "yes", " 1"])(
    "rechazan el valor %j en vez de adivinar qué quiso decir",
    (flag) => {
      expect(() => resolveIntegrationMode(flag)).toThrow(
        /RUN_INTEGRATION_TESTS/,
      );
    },
  );
});

// Los archivos de integración comparten una sola base. En paralelo se pisan:
// uno afirma que un admin ve exactamente dos mercados mientras otro crea los
// suyos de prueba, o que un idioma no existe mientras otro lo inserta.
describe("archivos de prueba en paralelo", () => {
  it("corren en paralelo cuando las pruebas de integración se saltan", () => {
    expect(allowsParallelFiles("skip")).toBe(true);
  });

  it("corren de uno en uno cuando hay base, para que no se pisen", () => {
    expect(allowsParallelFiles("run")).toBe(false);
  });
});
