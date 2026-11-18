import { describe, expect, it } from "vitest";

import { resolveIntegrationMode } from "./integration-mode";

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
