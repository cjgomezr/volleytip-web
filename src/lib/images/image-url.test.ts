import { describe, expect, it } from "vitest";

import { buildImageUrl, MAX_IMAGE_WIDTH } from "./image-url";

const CDN_HOST = "imagenes-de-prueba.b-cdn.net";
const WIDTH = 400;

function build(path: string, width: number = WIDTH): string {
  return buildImageUrl({ cdnHost: CDN_HOST, path, width });
}

describe("URL de imagen", () => {
  it("apunta al dominio del CDN con el ancho como parámetro", () => {
    expect(build("productos/balon.jpg")).toBe(
      "https://imagenes-de-prueba.b-cdn.net/productos/balon.jpg?width=400",
    );
  });

  it("da lo mismo con barra inicial que sin ella", () => {
    expect(build("/productos/balon.jpg")).toBe(build("productos/balon.jpg"));
  });

  it("codifica espacios, tildes y signos de pregunta", () => {
    expect(build("camps/enero 2027/¿quién juega?.jpg")).toBe(
      "https://imagenes-de-prueba.b-cdn.net/camps/enero%202027/%C2%BFqui%C3%A9n%20juega%3F.jpg?width=400",
    );
  });

  it("codifica los caracteres que cambiarían la URL", () => {
    const url = new URL(build("tips/saque#1&width=9999.jpg"));

    expect(url.pathname).toBe("/tips/saque%231%26width%3D9999.jpg");
    expect(url.search).toBe("?width=400");
    expect(url.hash).toBe("");
  });

  it("toma literal una ruta que ya venía codificada", () => {
    expect(build("camps/enero%202027.jpg")).toContain("enero%25202027.jpg");
  });

  it("acepta el ancho máximo", () => {
    expect(build("a.jpg", MAX_IMAGE_WIDTH)).toContain(
      `?width=${String(MAX_IMAGE_WIDTH)}`,
    );
  });
});

describe("URL de imagen: rechazos", () => {
  it.each(["", "   ", "/"])("rechaza la ruta vacía %j", (path) => {
    expect(() => build(path)).toThrow(/ruta/);
  });

  it.each([
    "https://otro-sitio.test/foto.jpg",
    "http://otro-sitio.test/foto.jpg",
    "https://imagenes-de-prueba.b-cdn.net/foto.jpg",
    "data:image/png;base64,AAAA",
  ])("rechaza la URL absoluta %j", (path) => {
    expect(() => build(path)).toThrow(/URL absoluta/);
  });

  it("rechaza una ruta que empieza por //", () => {
    expect(() => build("//otro-sitio.test/foto.jpg")).toThrow(/URL absoluta/);
  });

  it.each(["productos/../secreto.jpg", "./foto.jpg", "productos//foto.jpg"])(
    "rechaza la ruta con segmentos vacíos o relativos %j",
    (path) => {
      expect(() => build(path)).toThrow(/ruta/);
    },
  );

  it("rechaza una barra invertida, que algunos navegadores leen como barra", () => {
    expect(() => build(String.raw`productos\foto.jpg`)).toThrow(/ruta/);
  });

  it.each([0, -400, 400.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rechaza el ancho %j",
    (width) => {
      expect(() => build("a.jpg", width)).toThrow(/ancho/);
    },
  );

  it("rechaza un ancho enorme", () => {
    expect(() => build("a.jpg", MAX_IMAGE_WIDTH + 1)).toThrow(/ancho/);
  });

  it.each(["", "https://cdn.test", "cdn.test/carpeta", "cdn .test"])(
    "rechaza el dominio %j",
    (cdnHost) => {
      expect(() =>
        buildImageUrl({ cdnHost, path: "a.jpg", width: WIDTH }),
      ).toThrow(/dominio/);
    },
  );

  it.each(["brand/wordmark.png", "/brand/mark.png"])(
    "rechaza el logo %j: los logos se sirven desde el sitio",
    (path) => {
      expect(() => build(path)).toThrow(/logos/);
    },
  );
});
