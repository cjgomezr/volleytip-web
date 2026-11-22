import { describe, expect, it } from "vitest";

import { action } from "./language-choice";

async function submit(fields: Record<string, string>): Promise<Response> {
  const body = new URLSearchParams(fields);
  const request = new Request("http://localhost/idioma", {
    method: "POST",
    body,
  });
  const result = await action({ request } as Parameters<typeof action>[0]);
  if (!(result instanceof Response))
    throw new Error("Se esperaba una Response.");
  return result;
}

describe("aviso de idioma: acciones", () => {
  it("aceptar lleva a la misma página en el otro idioma y guarda la elección", async () => {
    const response = await submit({ language: "en", from: "/" });

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/en/");
    expect(response.headers.get("Set-Cookie")).toContain("vt_locale=");
  });

  it("aceptar conserva los parámetros de búsqueda", async () => {
    const response = await submit({ language: "en", from: "/?a=1&b=2" });

    expect(response.headers.get("Location")).toBe("/en/?a=1&b=2");
  });

  it("quedarse guarda el idioma de la página y vuelve a ella sin cambiar de página", async () => {
    const response = await submit({ language: "es", from: "/?a=1" });

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/?a=1");
    expect(response.headers.get("Set-Cookie")).toContain("vt_locale=");
  });

  it("desde una página en inglés, quedarse conserva /en/", async () => {
    const response = await submit({ language: "en", from: "/en/" });

    expect(response.headers.get("Location")).toBe("/en/");
  });

  it("la dirección de destino nunca sale del sitio", async () => {
    for (const from of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example",
      "javascript:alert(1)",
      "/\t/evil.example",
      "no-empieza-con-barra",
      "",
    ]) {
      const response = await submit({ language: "en", from });
      const location = response.headers.get("Location") ?? "";

      expect(location).toMatch(/^\/(en\/)?(\?|$)/);
      expect(location.startsWith("//")).toBe(false);
    }
  });

  it("una dirección que no es una página del sitio lleva a la home del idioma", async () => {
    const response = await submit({ language: "en", from: "/no-existe" });

    expect(response.headers.get("Location")).toBe("/en/");
  });

  it("rechaza un idioma no soportado sin guardar nada", async () => {
    for (const language of ["fr", "", "EN", "<b>"]) {
      const result = await action({
        request: new Request("http://localhost/idioma", {
          method: "POST",
          body: new URLSearchParams({ language, from: "/" }),
        }),
      } as Parameters<typeof action>[0]);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(400);
      expect((result as Response).headers.get("Set-Cookie")).toBeNull();
    }
  });
});
