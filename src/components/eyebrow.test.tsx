import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Eyebrow } from "./eyebrow";

describe("Eyebrow", () => {
  it("pinta el texto recibido", () => {
    const html = renderToStaticMarkup(<Eyebrow text="Quiénes somos" />);

    expect(html).toMatch(/^<p [^>]*>Quiénes somos<\/p>$/);
  });

  it("lleva la tipografía de la tabla: 700, 12 px, mayúsculas, 0.12em", () => {
    const html = renderToStaticMarkup(<Eyebrow text="Quiénes somos" />);

    expect(html).toContain("text-[12px]");
    expect(html).toContain("font-bold");
    expect(html).toContain("uppercase");
    expect(html).toContain("tracking-[0.12em]");
  });

  it.each(["", "   "])("con el texto %j no pinta nada", (text) => {
    expect(renderToStaticMarkup(<Eyebrow text={text} />)).toBe("");
  });
});
