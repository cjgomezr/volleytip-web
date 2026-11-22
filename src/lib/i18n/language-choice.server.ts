import { isbot } from "isbot";
import { createCookie } from "react-router";

import type { AppEnvironment } from "../env.server";

import { getPreferredLanguage } from "./browser-language";
import { getDocumentPath } from "./document-path";
import {
  getLanguageFromPath,
  isSupportedLanguage,
  type Language,
} from "./languages";
import { getPagePath } from "./pages";

// Decisión 7 del PRD de W2.
export const LANGUAGE_COOKIE_NAME = "vt_locale";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
// Solo en la máquina de quien programa el sitio se sirve sin cifrar.
const ENVIRONMENTS_WITHOUT_SECURE: readonly AppEnvironment[] = [
  "local",
  "test",
];
const FOUND = 302;
const ROOT_PATH = "/";
// La respuesta cambia con lo que la persona guardó y con lo que su navegador
// dice, así que una caché compartida no puede servírsela a otra.
const VARYING_HEADERS = [
  "Cookie",
  "Accept-Language",
  "User-Agent",
  "Sec-Fetch-Site",
];
// Directivas de `Cache-Control` que ya impiden guardar en una caché compartida.
// Sin `=`: `private="set-cookie"` solo protege las cabeceras que nombra, y
// una caché compartida podría guardar el resto.
const ALREADY_PRIVATE = /(^|[\s,])(private|no-store)(?=$|[\s,])/i;

function createLanguageCookie(
  appEnv: AppEnvironment,
): ReturnType<typeof createCookie> {
  return createCookie(LANGUAGE_COOKIE_NAME, {
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
    path: "/",
    secure: !ENVIRONMENTS_WITHOUT_SECURE.includes(appEnv),
  });
}

// Leer no necesita los atributos de escritura.
const READING_COOKIE = createLanguageCookie("local");

/** El idioma que la persona eligió, o `undefined` si no hay cookie o su
 * valor no es un idioma soportado. */
export async function readLanguageChoice(
  request: Request,
): Promise<Language | undefined> {
  const value: unknown = await READING_COOKIE.parse(
    request.headers.get("Cookie"),
  );
  return typeof value === "string" && isSupportedLanguage(value)
    ? value
    : undefined;
}

/** El valor de `Set-Cookie` que guarda la elección. */
export function serializeLanguageChoice(
  language: Language,
  appEnv: AppEnvironment,
): Promise<string> {
  return createLanguageCookie(appEnv).serialize(language);
}

// El navegador dice con `Sec-Fetch-Site` de dónde sale una petición.
// "same-origin" es alguien que ya está en el sitio y sigue un enlace, o la
// propia página pidiendo datos al navegar. Un navegador viejo no la manda.
const FETCH_SITE_HEADER = "Sec-Fetch-Site";
const FROM_THIS_SITE = "same-origin";

function comesFromThisSite(request: Request): boolean {
  return request.headers.get(FETCH_SITE_HEADER) === FROM_THIS_SITE;
}

function isRobot(request: Request): boolean {
  // Sin agente de usuario no es un navegador de verdad.
  return isbot(request.headers.get("User-Agent") ?? "");
}

/** El idioma que el aviso propone, o `undefined` si no debe salir: hay
 * elección guardada, es un robot, el navegador no pide un idioma soportado
 * o ya es el de la página. */
export async function getLanguageProposal(
  request: Request,
): Promise<Language | undefined> {
  if (isRobot(request)) return undefined;
  if ((await readLanguageChoice(request)) !== undefined) return undefined;
  const preferred = getPreferredLanguage(
    request.headers.get("Accept-Language"),
  );
  const pageLanguage = getLanguageFromPath(
    getDocumentPath(new URL(request.url)),
  );
  return preferred === pageLanguage ? undefined : preferred;
}

/**
 * Solo la raíz sin prefijo, solo con una elección guardada distinta del
 * idioma por defecto, nunca para un robot y solo a quien llega de fuera
 * (escribió la dirección, abrió un marcador, viene de un buscador).
 *
 * A quien ya está en el sitio y sigue un enlace a la raíz se le respeta la
 * dirección. Si no, alguien con inglés guardado que elige "Español" en el
 * selector sin JavaScript, que ahí es un enlace y no guarda nada, volvería a
 * caer en /en/ cada vez.
 */
export async function redirectRootToChosenLanguage(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (getDocumentPath(url) !== ROOT_PATH || isRobot(request)) return null;
  if (comesFromThisSite(request)) return null;
  const choice = await readLanguageChoice(request);
  if (choice === undefined) return null;
  const target = getPagePath("home", choice);
  if (target === ROOT_PATH) return null;
  return new Response(null, {
    status: FOUND,
    headers: { Location: `${target}${url.search}` },
  });
}

/** Marca la respuesta como dependiente de la cookie y del navegador. */
export function addVaryHeaders(response: Response): Response {
  // Se copia en vez de modificar: hay respuestas con cabeceras inmutables.
  const headers = new Headers(response.headers);
  const vary = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== ""),
  );
  for (const name of VARYING_HEADERS) vary.add(name);
  headers.set("Vary", [...vary].join(", "));
  // Una ruta que ya impide la caché compartida (`private`, `no-store`) se
  // respeta: su regla puede ser más estricta que esta y no se afloja aquí.
  const routeRule = headers.get("Cache-Control") ?? "";
  if (!ALREADY_PRIVATE.test(routeRule)) {
    headers.set("Cache-Control", "private");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
