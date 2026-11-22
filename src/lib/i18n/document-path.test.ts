import { describe, expect, it } from "vitest";

import { getDocumentPath } from "./document-path";

describe("dirección de la página detrás de una petición de datos", () => {
  it.each([
    ["/", "/"],
    ["/en/", "/en/"],
    ["/dev/componentes", "/dev/componentes"],
    ["/_root.data", "/"],
    ["/en.data", "/en"],
    ["/en/_.data", "/en/"],
    ["/dev/componentes.data", "/dev/componentes"],
  ])("%s es la página %s", (requested, expected) => {
    expect(getDocumentPath(new URL(`http://localhost${requested}`))).toBe(
      expected,
    );
  });
});
