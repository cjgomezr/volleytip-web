import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnouncementBar } from "./announcement-bar";

describe("Barra de anuncios", () => {
  it("pinta cada mensaje recibido", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar
        messages={["Envíos a toda Colombia", "Camp de enero"]}
      />,
    );

    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("Envíos a toda Colombia");
    expect(html).toContain("Camp de enero");
  });

  it("lleva los colores y la tipografía de la tabla", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar messages={["Envíos a toda Colombia"]} />,
    );

    expect(html).toContain("bg-brand-lime");
    expect(html).toContain("text-brand-night");
    expect(html).toContain("text-[13px]");
    expect(html).toContain("tracking-[0.08em]");
    expect(html).toContain("uppercase");
  });

  it("descarta los mensajes vacíos", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar messages={["", "Camp de enero", "  "]} />,
    );

    expect(html.match(/<li/g)).toHaveLength(1);
  });

  it.each([[[]], [[""]], [["", "  "]]])(
    "con los mensajes %j no pinta un contenedor vacío",
    (messages) => {
      expect(
        renderToStaticMarkup(<AnnouncementBar messages={messages} />),
      ).toBe("");
    },
  );
});
