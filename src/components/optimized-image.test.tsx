import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OptimizedImage } from "./optimized-image";

const CDN_HOST = "imagenes-de-prueba.b-cdn.net";
const BASE = "https://imagenes-de-prueba.b-cdn.net/productos/balon.jpg";

function readAttribute(html: string, name: string): string | undefined {
  return new RegExp(` ${name}="([^"]*)"`).exec(html)?.[1];
}

function renderImage(
  overrides: Partial<ComponentProps<typeof OptimizedImage>> = {},
): string {
  return renderToStaticMarkup(
    <OptimizedImage
      cdnHost={CDN_HOST}
      src="productos/balon.jpg"
      alt="Balón oficial"
      width={400}
      height={300}
      {...overrides}
    />,
  );
}

describe("Imagen optimizada", () => {
  it("ofrece el ancho normal y el de alta densidad", () => {
    expect(readAttribute(renderImage(), "srcSet")).toBe(
      `${BASE}?width=400 400w, ${BASE}?width=800 800w`,
    );
  });

  it("lleva sizes con el ancho al que se muestra", () => {
    expect(readAttribute(renderImage(), "sizes")).toBe("400px");
  });

  it("acepta un sizes propio para imágenes que cambian con la pantalla", () => {
    const html = renderImage({ sizes: "(min-width: 768px) 400px, 100vw" });

    expect(readAttribute(html, "sizes")).toBe(
      "(min-width: 768px) 400px, 100vw",
    );
  });

  it("el src es el del ancho normal", () => {
    expect(readAttribute(renderImage(), "src")).toBe(`${BASE}?width=400`);
  });

  it("lleva width y height para reservar su espacio antes de cargar", () => {
    const html = renderImage();

    expect(readAttribute(html, "width")).toBe("400");
    expect(readAttribute(html, "height")).toBe("300");
  });

  it("lleva el texto alternativo", () => {
    expect(readAttribute(renderImage(), "alt")).toBe("Balón oficial");
  });

  it("una imagen decorativa lleva alt vacío, no lo omite", () => {
    expect(renderImage({ alt: "" })).toContain(' alt=""');
  });

  it("el ancho de alta densidad no pasa del máximo del CDN", () => {
    const srcSet = readAttribute(renderImage({ width: 3000 }), "srcSet");

    expect(srcSet).toBe(`${BASE}?width=3000 3000w, ${BASE}?width=4096 4096w`);
  });

  it("en el ancho máximo no repite el mismo candidato", () => {
    const srcSet = readAttribute(renderImage({ width: 4096 }), "srcSet");

    expect(srcSet).toBe(`${BASE}?width=4096 4096w`);
  });

  it("pasa las clases al <img>", () => {
    const html = renderImage({ className: "rounded-card" });

    expect(readAttribute(html, "class")).toBe("rounded-card");
  });
});

describe("Imagen optimizada: carga", () => {
  it("por defecto es diferida", () => {
    const html = renderImage();

    expect(readAttribute(html, "loading")).toBe("lazy");
    expect(html.toLowerCase()).not.toContain("fetchpriority");
  });

  it("prioritaria carga de inmediato y con prioridad alta", () => {
    const html = renderImage({ isPriority: true });

    expect(readAttribute(html, "loading")).toBe("eager");
    expect(readAttribute(html.toLowerCase(), "fetchpriority")).toBe("high");
  });
});

describe("Imagen optimizada: tipos", () => {
  it("sin alt no compila", () => {
    const image = (
      // @ts-expect-error -- el tipo exige alt: una imagen sin él no es accesible
      <OptimizedImage cdnHost={CDN_HOST} src="a.jpg" width={400} height={300} />
    );

    expect(image).toBeDefined();
  });

  it("sin width no compila", () => {
    const image = (
      // @ts-expect-error -- sin width la imagen no reserva su espacio
      <OptimizedImage cdnHost={CDN_HOST} src="a.jpg" alt="" height={300} />
    );

    expect(image).toBeDefined();
  });

  it("sin height no compila", () => {
    const image = (
      // @ts-expect-error -- sin height la imagen no reserva su espacio
      <OptimizedImage cdnHost={CDN_HOST} src="a.jpg" alt="" width={400} />
    );

    expect(image).toBeDefined();
  });
});
