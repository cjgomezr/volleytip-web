import { describe, expect, it } from "vitest";

import {
  readTableScope,
  reviewCatalog,
  type CatalogTable,
} from "./catalog-review";

function buildTable(overrides: Partial<CatalogTable> = {}): CatalogTable {
  return {
    name: "orders",
    hasRowLevelSecurity: true,
    comment: "scope: web. Pedidos.",
    ...overrides,
  };
}

describe("ámbito de una tabla", () => {
  it.each([
    ["scope: shared", "shared"],
    ["scope: web", "web"],
    ["scope: shared. Perfil de cada persona.", "shared"],
    ["scope: web. Ajustes del sitio (FR-067).", "web"],
    ["scope: web\nSegunda línea del comentario.", "web"],
  ] as const)("lee el ámbito de %j", (comment, expectedScope) => {
    expect(readTableScope(comment)).toBe(expectedScope);
  });

  it.each([
    ["mayúscula en el valor", "scope: Shared"],
    ["mayúscula en la palabra clave", "Scope: shared"],
    ["ámbito vacío", "scope:"],
    ["ámbito vacío con texto después", "scope: . Ajustes."],
    ["valor desconocido", "scope: app"],
    ["valor que solo empieza igual", "scope: website"],
    ["valor con guion", "scope: web-only"],
    ["dos ámbitos", "scope: shared. scope: web."],
    ["el mismo ámbito dos veces", "scope: web. scope: web."],
    ["ámbito que no abre el comentario", "Pedidos. scope: web"],
    ["sin espacio después de los dos puntos", "scope:web"],
    ["comentario sin ámbito", "Pedidos de la tienda."],
    ["comentario vacío", ""],
  ] as const)("no acepta %s", (_case, comment) => {
    expect(readTableScope(comment)).toBeNull();
  });

  it("no acepta una tabla sin comentario", () => {
    expect(readTableScope(null)).toBeNull();
  });
});

describe("revisión del catálogo", () => {
  it("no reporta nada cuando todas las tablas están bien", () => {
    const tables = [
      buildTable({ name: "profiles", comment: "scope: shared. Perfiles." }),
      buildTable({ name: "settings" }),
    ];

    expect(reviewCatalog(tables)).toEqual([]);
  });

  it("no reporta nada con una lista vacía", () => {
    expect(reviewCatalog([])).toEqual([]);
  });

  it("nombra la tabla que no tiene RLS", () => {
    const problems = reviewCatalog([
      buildTable({ name: "orders", hasRowLevelSecurity: false }),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/public\.orders/);
    expect(problems[0]).toMatch(/RLS/);
  });

  it("nombra la tabla que no tiene comentario", () => {
    const problems = reviewCatalog([
      buildTable({ name: "orders", comment: null }),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/public\.orders/);
    expect(problems[0]).toMatch(/no tiene comentario/);
  });

  it("nombra la tabla con ámbito inválido y los dos valores válidos", () => {
    const problems = reviewCatalog([
      buildTable({ name: "orders", comment: "scope: app. Pedidos." }),
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/public\.orders/);
    expect(problems[0]).toMatch(/scope: shared/);
    expect(problems[0]).toMatch(/scope: web/);
  });

  it("muestra el comentario que encontró cuando el ámbito es inválido", () => {
    const [problem] = reviewCatalog([
      buildTable({ comment: "scope: app. Pedidos." }),
    ]);

    expect(problem).toContain("scope: app. Pedidos.");
  });

  it("nombra todas las tablas con problemas, no solo la primera", () => {
    const problems = reviewCatalog([
      buildTable({ name: "orders", hasRowLevelSecurity: false }),
      buildTable({ name: "settings" }),
      buildTable({ name: "tickets", comment: null }),
      buildTable({ name: "carts", comment: "scope: app" }),
    ]);

    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/public\.orders/);
    expect(problems.join("\n")).toMatch(/public\.tickets/);
    expect(problems.join("\n")).toMatch(/public\.carts/);
    expect(problems.join("\n")).not.toMatch(/public\.settings/);
  });

  it("reporta los dos problemas de una tabla sin RLS y sin comentario", () => {
    const problems = reviewCatalog([
      buildTable({
        name: "orders",
        hasRowLevelSecurity: false,
        comment: null,
      }),
    ]);

    expect(problems).toHaveLength(2);
    expect(problems.every((problem) => problem.includes("public.orders"))).toBe(
      true,
    );
  });
});
