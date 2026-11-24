import { describe, expect, it } from "vitest";

import { isRoutineCode, MAX_ROUTINE_CODE_LENGTH } from "./routine-code";

describe("código de rutina", () => {
  it.each(["abc123", "A", "a-b_c", "ABC-123_x"])("acepta %s", (code) => {
    expect(isRoutineCode(code)).toBe(true);
  });

  it("rechaza el código vacío", () => {
    expect(isRoutineCode("")).toBe(false);
  });

  it("acepta 64 caracteres y rechaza 65", () => {
    expect(MAX_ROUTINE_CODE_LENGTH).toBe(64);
    expect(isRoutineCode("a".repeat(64))).toBe(true);
    expect(isRoutineCode("a".repeat(65))).toBe(false);
  });

  it.each(["a b", "á", "a.b", "a?b", "a#b", "a<b>", "a%20b", "a\nb"])(
    "rechaza los caracteres raros de %j",
    (code) => {
      expect(isRoutineCode(code)).toBe(false);
    },
  );

  it("rechaza una barra dentro del código", () => {
    expect(isRoutineCode("a/b")).toBe(false);
  });
});
