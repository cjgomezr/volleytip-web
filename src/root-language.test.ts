import { describe, expect, it } from "vitest";

import { loader, middleware } from "./root";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const BOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const ENGLISH_CHOICE = "vt_locale=ImVuIg%3D%3D";

function requestFor(
  path: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    headers: { "user-agent": BROWSER_UA, ...headers },
  });
}

async function runMiddleware(request: Request): Promise<Response> {
  const [first] = middleware;
  if (first === undefined) throw new Error("Falta el middleware.");
  const next = (): Promise<Response> => Promise.resolve(new Response("pagina"));
  const result = await first(
    { request, params: {}, context: {} } as unknown as Parameters<
      typeof first
    >[0],
    next,
  );
  if (!(result instanceof Response))
    throw new Error("Se esperaba una Response.");
  return result;
}

function loadRoot(request: Request): ReturnType<typeof loader> {
  return loader({ request } as Parameters<typeof loader>[0]);
}

describe("raíz: elección de idioma", () => {
  it("el loader propone inglés con los textos en inglés a un navegador en inglés", async () => {
    const data = await loadRoot(
      requestFor("/", { "accept-language": "en-US,en;q=0.9" }),
    );

    expect(data.languageSuggestion?.proposed).toBe("en");
    expect(data.languageSuggestion?.pageLanguage).toBe("es");
    expect(data.languageSuggestion?.texts.accept).toBe("View in English");
  });

  it("el loader no propone nada a un robot, a un navegador en español ni con elección guardada", async () => {
    const bot = await loadRoot(
      requestFor("/", { "accept-language": "en", "user-agent": BOT_UA }),
    );
    const spanish = await loadRoot(
      requestFor("/", { "accept-language": "es" }),
    );
    const chosen = await loadRoot(
      requestFor("/", { "accept-language": "en", cookie: ENGLISH_CHOICE }),
    );

    expect(bot.languageSuggestion).toBeNull();
    expect(spanish.languageSuggestion).toBeNull();
    expect(chosen.languageSuggestion).toBeNull();
  });

  it("la página responde 200 con Vary y Cache-Control privado, sin redirigir", async () => {
    const response = await runMiddleware(
      requestFor("/", { "accept-language": "en" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Vary")).toContain("Accept-Language");
    expect(response.headers.get("Cache-Control")).toBe("private");
  });

  it("la raíz con inglés guardado redirige a /en/ con Vary", async () => {
    const response = await runMiddleware(
      requestFor("/", { cookie: ENGLISH_CHOICE }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/en/");
    expect(response.headers.get("Vary")).toContain("Cookie");
  });

  it("otra dirección sin prefijo con inglés guardado no redirige", async () => {
    const response = await runMiddleware(
      requestFor("/tienda", { cookie: ENGLISH_CHOICE }),
    );

    expect(response.status).toBe(200);
  });

  it("la raíz con inglés guardado no redirige a un robot", async () => {
    const response = await runMiddleware(
      requestFor("/", { cookie: ENGLISH_CHOICE, "user-agent": BOT_UA }),
    );

    expect(response.status).toBe(200);
  });
});
