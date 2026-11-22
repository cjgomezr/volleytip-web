import { serverEnv } from "~/lib/env.server";
import { isSupportedLanguage, type Language } from "~/lib/i18n/languages";
import { serializeLanguageChoice } from "~/lib/i18n/language-choice.server";
import { getPageAtPath, getPagePath } from "~/lib/i18n/pages";

import type { Route } from "./+types/language-choice";

const SEE_OTHER = 303;
const BAD_REQUEST = 400;
// Solo sirve para que `URL` interprete una dirección relativa y para
// comprobar que no apunta a otro sitio.
const PARSING_ORIGIN = "http://internal.invalid";

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Nunca se redirige a lo que llega en la petición: se lee solo la página y la
// búsqueda, y la dirección se arma con el mapa de páginas.
function buildDestination(from: string, language: Language): string {
  const homePath = getPagePath("home", language);
  if (!from.startsWith("/")) return homePath;
  const url = new URL(from, PARSING_ORIGIN);
  if (url.origin !== PARSING_ORIGIN) return homePath;
  const current = getPageAtPath(url.pathname);
  if (current === undefined) return homePath;
  return `${getPagePath(current.page, language, current.params)}${url.search}`;
}

// No pasa por `processProtectedForm`: no guarda datos de nadie ni acepta
// texto libre. Solo un idioma de una lista cerrada y una dirección que se
// vuelve a armar desde el mapa de páginas.
export async function action({ request }: Route.ActionArgs): Promise<Response> {
  const formData = await request.formData();
  const language = readText(formData, "language");
  if (!isSupportedLanguage(language)) {
    return new Response(null, { status: BAD_REQUEST });
  }
  const destination = buildDestination(readText(formData, "from"), language);
  return new Response(null, {
    status: SEE_OTHER,
    headers: {
      Location: destination,
      "Set-Cookie": await serializeLanguageChoice(language, serverEnv.appEnv),
    },
  });
}
