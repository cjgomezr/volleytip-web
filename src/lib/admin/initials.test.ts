import { describe, expect, it } from "vitest";

import { getInitials } from "./initials";

describe("iniciales de quien entró", () => {
  it.each([
    ["Andrés Piza", "AP"],
    ["  ana  ", "A"],
    ["María del Mar Gómez", "MD"],
    ["andres@prueba.volleytip.test", "A"],
    ["óscar úsuga", "ÓÚ"],
    ["🏐 Ana", "🏐A"],
  ])("de %s saca %s", (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});
