import { describe, expect, it } from "vitest";
import {
  assertThemesDiffer,
  parseReviewThemes,
} from "../../../scripts/ui-review/themes.ts";

describe("parseReviewThemes", () => {
  it("captura claro y oscuro cuando la configuración no dice nada", () => {
    expect(parseReviewThemes({})).toEqual(["light", "dark"]);
    expect(parseReviewThemes({ review: { uiReview: "label" } })).toEqual([
      "light",
      "dark",
    ]);
  });

  it("captura un solo tema en un proyecto que solo tiene uno", () => {
    expect(parseReviewThemes({ review: { themes: ["light"] } })).toEqual([
      "light",
    ]);
  });

  it("respeta el orden pedido", () => {
    expect(
      parseReviewThemes({ review: { themes: ["dark", "light"] } }),
    ).toEqual(["dark", "light"]);
  });

  it("rechaza una lista vacía en vez de no capturar nada", () => {
    expect(() => parseReviewThemes({ review: { themes: [] } })).toThrow(
      /review\.themes/,
    );
  });

  it("rechaza un tema que no conoce, nombrándolo", () => {
    expect(() =>
      parseReviewThemes({ review: { themes: ["light", "sepia"] } }),
    ).toThrow(/sepia/);
  });

  it("rechaza un tema repetido", () => {
    expect(() =>
      parseReviewThemes({ review: { themes: ["light", "light"] } }),
    ).toThrow(/review\.themes/);
  });

  it("rechaza un valor que no es una lista", () => {
    expect(() => parseReviewThemes({ review: { themes: "light" } })).toThrow(
      /review\.themes/,
    );
  });
});

describe("assertThemesDiffer", () => {
  const first = Buffer.from("una imagen");
  const second = Buffer.from("otra imagen");

  it("falla cuando claro y oscuro salen idénticos", () => {
    const captures = new Map([
      ["light", first],
      ["dark", Buffer.from(first)],
    ] as const);

    expect(() => assertThemesDiffer("mobile", captures)).toThrow(
      /review\.themes/,
    );
  });

  it("acepta dos temas con capturas distintas", () => {
    const captures = new Map([
      ["light", first],
      ["dark", second],
    ] as const);

    expect(() => assertThemesDiffer("mobile", captures)).not.toThrow();
  });

  it("no compara nada cuando se capturó un solo tema", () => {
    const captures = new Map([["light", first]] as const);

    expect(() => assertThemesDiffer("mobile", captures)).not.toThrow();
  });
});
