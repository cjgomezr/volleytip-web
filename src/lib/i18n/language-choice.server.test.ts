import { describe, expect, it } from "vitest";

import {
  LANGUAGE_COOKIE_NAME,
  readLanguageChoice,
  redirectRootToChosenLanguage,
  serializeLanguageChoice,
  addVaryHeaders,
  getLanguageProposal,
} from "./language-choice.server";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const BOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

interface RequestOptions {
  readonly cookie?: string;
  readonly acceptLanguage?: string;
  readonly userAgent?: string;
}

function requestFor(path: string, options: RequestOptions = {}): Request {
  const headers = new Headers({
    "user-agent": options.userAgent ?? BROWSER_UA,
  });
  if (options.cookie !== undefined) headers.set("cookie", options.cookie);
  if (options.acceptLanguage !== undefined) {
    headers.set("accept-language", options.acceptLanguage);
  }
  return new Request(`http://localhost${path}`, { headers });
}

async function cookieFor(language: string): Promise<string> {
  const setCookie = await serializeLanguageChoice(
    language as "es" | "en",
    "local",
  );
  return setCookie.split(";")[0] ?? "";
}

describe("cookie de idioma", () => {
  it("lee el idioma que ella misma escribió", async () => {
    const cookie = await cookieFor("en");

    expect(await readLanguageChoice(requestFor("/", { cookie }))).toBe("en");
  });

  it("devuelve undefined sin cookie", async () => {
    expect(await readLanguageChoice(requestFor("/"))).toBeUndefined();
  });

  it("ignora un idioma no soportado", async () => {
    const cookie = `${LANGUAGE_COOKIE_NAME}=${btoa(JSON.stringify("fr"))}`;

    expect(
      await readLanguageChoice(requestFor("/", { cookie })),
    ).toBeUndefined();
  });

  it("ignora cualquier otro texto, incluso con caracteres raros", async () => {
    for (const value of [
      "en",
      "%E0%A4%A",
      "<script>",
      "'; DROP",
      "e".repeat(5000),
      '"en"',
    ]) {
      const cookie = `${LANGUAGE_COOKIE_NAME}=${value}`;

      expect(
        await readLanguageChoice(requestFor("/", { cookie })),
      ).toBeUndefined();
    }
  });

  it("se llama vt_locale, dura un año, es SameSite=Lax y Path=/", async () => {
    const setCookie = await serializeLanguageChoice("en", "local");

    expect(setCookie).toMatch(/^vt_locale=/);
    expect(setCookie).toContain("Max-Age=31536000");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("lleva Secure fuera de local y test", async () => {
    for (const env of ["staging", "production"] as const) {
      expect(await serializeLanguageChoice("en", env)).toContain("Secure");
    }
    for (const env of ["local", "test"] as const) {
      expect(await serializeLanguageChoice("en", env)).not.toContain("Secure");
    }
  });
});

describe("aviso de idioma: cuándo sale", () => {
  async function proposal(
    path: string,
    options: RequestOptions,
  ): ReturnType<typeof getLanguageProposal> {
    return getLanguageProposal(requestFor(path, options));
  }

  it("navegador en inglés, sin elección, página en español: propone inglés", async () => {
    expect(await proposal("/", { acceptLanguage: "en-US,en;q=0.9" })).toBe(
      "en",
    );
  });

  it("navegador en español, sin elección, página en inglés: propone español", async () => {
    expect(await proposal("/en/", { acceptLanguage: "es" })).toBe("es");
  });

  it("el idioma del navegador coincide con el de la página: no propone", async () => {
    expect(await proposal("/en/", { acceptLanguage: "en" })).toBeUndefined();
    expect(await proposal("/", { acceptLanguage: "es-CO" })).toBeUndefined();
  });

  it("idiomas no soportados o cabecera ausente: no propone", async () => {
    expect(await proposal("/", { acceptLanguage: "fr,de" })).toBeUndefined();
    expect(await proposal("/", {})).toBeUndefined();
  });

  it("con una elección guardada nunca propone", async () => {
    const spanish = await cookieFor("es");
    const english = await cookieFor("en");

    expect(
      await proposal("/", { acceptLanguage: "en", cookie: spanish }),
    ).toBeUndefined();
    expect(
      await proposal("/en/", { acceptLanguage: "es", cookie: english }),
    ).toBeUndefined();
  });

  it("una cookie inválida se trata como primera visita", async () => {
    const cookie = `${LANGUAGE_COOKIE_NAME}=basura`;

    expect(await proposal("/", { acceptLanguage: "en", cookie })).toBe("en");
  });

  it("a un buscador o un robot no le propone nada", async () => {
    expect(
      await proposal("/", { acceptLanguage: "en", userAgent: BOT_UA }),
    ).toBeUndefined();
  });
});

describe("raíz con elección guardada", () => {
  it("/ con inglés guardado redirige a /en/ con una redirección temporal", async () => {
    const cookie = await cookieFor("en");

    const response = await redirectRootToChosenLanguage(
      requestFor("/", { cookie }),
    );

    expect(response?.status).toBe(302);
    expect(response?.headers.get("Location")).toBe("/en/");
  });

  it("conserva la búsqueda", async () => {
    const cookie = await cookieFor("en");

    const response = await redirectRootToChosenLanguage(
      requestFor("/?a=1", { cookie }),
    );

    expect(response?.headers.get("Location")).toBe("/en/?a=1");
  });

  it("/ con español guardado, o sin elección, no redirige", async () => {
    const cookie = await cookieFor("es");

    expect(
      await redirectRootToChosenLanguage(requestFor("/", { cookie })),
    ).toBeNull();
    expect(await redirectRootToChosenLanguage(requestFor("/"))).toBeNull();
  });

  it("cualquier otra dirección sin prefijo se respeta", async () => {
    const cookie = await cookieFor("en");

    expect(
      await redirectRootToChosenLanguage(requestFor("/tienda", { cookie })),
    ).toBeNull();
    expect(
      await redirectRootToChosenLanguage(requestFor("/en/", { cookie })),
    ).toBeNull();
  });

  it("un robot no recibe redirección", async () => {
    const cookie = await cookieFor("en");

    expect(
      await redirectRootToChosenLanguage(
        requestFor("/", { cookie, userAgent: BOT_UA }),
      ),
    ).toBeNull();
  });
});

describe("caché", () => {
  it("declara Vary y Cache-Control privado", () => {
    const response = addVaryHeaders(
      new Response("x", { headers: { Vary: "Accept-Encoding" } }),
    );

    const vary = response.headers.get("Vary") ?? "";
    expect(vary).toContain("Accept-Encoding");
    for (const name of ["Cookie", "Accept-Language", "User-Agent"]) {
      expect(vary).toContain(name);
    }
    expect(response.headers.get("Cache-Control")).toBe("private");
  });

  it("también vale para una redirección con cabeceras inmutables", () => {
    const response = addVaryHeaders(
      Response.redirect("http://localhost/en/", 302),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Cache-Control")).toBe("private");
  });
});
