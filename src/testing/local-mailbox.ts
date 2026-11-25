// El buzón de pruebas de Supabase CLI: los correos de la base local no salen
// de la máquina. Sin importaciones con `~`: también lo usa Playwright.

/** El puerto es el de `[local_smtp]` en `supabase/config.toml`. */
const MAILBOX_URL = "http://127.0.0.1:54324/api/v1";
const POLL_INTERVAL_MS = 200;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface LocalEmail {
  readonly subject: string;
  readonly html: string;
}

async function readJson<Body>(path: string): Promise<Body> {
  const response = await fetch(`${MAILBOX_URL}${path}`);
  if (!response.ok) {
    throw new Error(`El buzón de pruebas respondió ${response.status}`);
  }
  return (await response.json()) as Body;
}

/** Los correos que han llegado a una dirección, del más reciente al más
 * antiguo. */
export async function listEmailIds(to: string): Promise<string[]> {
  const query = new URLSearchParams({ query: `to:"${to}"` }).toString();
  const { messages } = await readJson<{ messages: { ID: string }[] }>(
    `/search?${query}`,
  );
  return messages.map(({ ID }) => ID);
}

/** Espera el correo de una dirección y lo devuelve. */
export async function waitForEmail(
  to: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<LocalEmail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [id] = await listEmailIds(to);
    if (id !== undefined) {
      const message = await readJson<{ Subject: string; HTML: string }>(
        `/message/${id}`,
      );
      return { subject: message.Subject, html: message.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("No llegó ningún correo al buzón de pruebas");
}

/** El enlace del correo que va a esa ruta. */
export function findLink(email: LocalEmail, pathname: string): URL {
  const links = [...email.html.matchAll(/href="([^"]+)"/g)].map(
    ([, href = ""]) => new URL(href.replaceAll("&amp;", "&")),
  );
  const link = links.find((candidate) => candidate.pathname === pathname);
  if (link === undefined) {
    throw new Error(`El correo no trae un enlace a ${pathname}`);
  }
  return link;
}
