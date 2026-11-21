import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLIENT_BUILD = path.join(REPO_ROOT, "build/client");
const SERVER_BUNDLE = path.join(REPO_ROOT, "build/server/index.js");
const SERVER_ENV_NAMES = Object.keys({
  APP_ENV: true,
  SUPABASE_URL: true,
  SUPABASE_ANON_KEY: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  TURNSTILE_SITE_KEY: true,
  TURNSTILE_SECRET_KEY: true,
  FORM_PROTECTION_SECRET: true,
  CLIENT_IP_HEADER: true,
  CLIENT_IP_TRUSTED_HOPS: true,
  IMAGE_CDN_HOST: true,
});
const REACT_ROUTER_CLI = path.join(
  REPO_ROOT,
  "node_modules/@react-router/dev/bin.cjs",
);
const BUILD_TIMEOUT_MS = 120_000;
// Separa el resultado de cualquier otra cosa que el servidor imprima.
const RESULT_MARKER = "@@respuestas@@";
const TEXT_ASSET = /\.(js|css|html|json|map|txt)$/;

// Valores que solo existen en este test. Si alguno aparece en lo que se
// envía al navegador, el build está filtrando un secreto del servidor.
const SENTINEL_ENV = {
  APP_ENV: "production",
  SUPABASE_URL: "https://centinela-url-7f3a9c.supabase.test",
  SUPABASE_ANON_KEY: "centinela-llave-publica-2b8e41",
  SUPABASE_SERVICE_ROLE_KEY: "centinela-llave-de-servicio-9d05c7",
  // No son las llaves de prueba de Cloudflare: en producción se rechazan.
  TURNSTILE_SITE_KEY: "centinela-llave-de-sitio-turnstile-51c2",
  TURNSTILE_SECRET_KEY: "centinela-llave-secreta-turnstile-a7e3",
  FORM_PROTECTION_SECRET: "centinela-secreto-de-formularios-4d19f0b6",
  CLIENT_IP_HEADER: "X-Forwarded-For",
  CLIENT_IP_TRUSTED_HOPS: "1",
  IMAGE_CDN_HOST: "imagenes-de-prueba.b-cdn.net",
} as const;
const SECRET_SENTINELS = [
  SENTINEL_ENV.SUPABASE_URL,
  SENTINEL_ENV.SUPABASE_ANON_KEY,
  SENTINEL_ENV.SUPABASE_SERVICE_ROLE_KEY,
  SENTINEL_ENV.TURNSTILE_SECRET_KEY,
  SENTINEL_ENV.FORM_PROTECTION_SECRET,
];

interface ClientAsset {
  readonly file: string;
  readonly content: string;
}

function buildWithSentinels(): void {
  const result = spawnSync(process.execPath, [REACT_ROUTER_CLI, "build"], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...SENTINEL_ENV },
    encoding: "utf8",
    timeout: BUILD_TIMEOUT_MS,
  });
  if (result.status !== 0) {
    throw new Error(`El build falló:\n${result.stdout}\n${result.stderr}`);
  }
}

function readClientAssets(): ClientAsset[] {
  return readdirSync(CLIENT_BUILD, { recursive: true, encoding: "utf8" })
    .filter((file) => TEXT_ASSET.test(file))
    .map((file) => ({
      file,
      content: readFileSync(path.join(CLIENT_BUILD, file), "utf8"),
    }));
}

function findLeaks(assets: readonly ClientAsset[]): string[] {
  return assets.flatMap(({ file, content }) =>
    SECRET_SENTINELS.filter((sentinel) => content.includes(sentinel)).map(
      (sentinel) => `${file} contiene ${sentinel}`,
    ),
  );
}

// Un solo build para todo el archivo: los dos bloques leen lo que dejó.
beforeAll(buildWithSentinels, BUILD_TIMEOUT_MS);

describe("secretos en el cliente", () => {
  it("ningún valor secreto del entorno aparece en build/client", () => {
    const assets = readClientAssets();

    expect(assets.length).toBeGreaterThan(0);
    expect(findLeaks(assets)).toEqual([]);
  });

  it("la búsqueda detecta un secreto dentro de un archivo del cliente", () => {
    const leaky = [
      {
        file: "assets/entry.js",
        content: `const key = "${SENTINEL_ENV.SUPABASE_SERVICE_ROLE_KEY}";`,
      },
    ];

    expect(findLeaks(leaky)).toHaveLength(1);
  });
});

/** Carga el bundle del servidor en un proceso aparte, como hace
 * `npm run start`, con las variables de entorno que se le pasen. */
function loadServerBundle(serverEnv: Record<string, string>): {
  exitCode: number | null;
  stderr: string;
} {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !SERVER_ENV_NAMES.includes(name),
    ),
  );
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(pathToFileURL(SERVER_BUNDLE).href)});`,
    ],
    {
      cwd: REPO_ROOT,
      env: { ...inherited, ...serverEnv },
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  return { exitCode: result.status, stderr: result.stderr };
}

interface ServedRequest {
  readonly method: string;
  readonly path: string;
}

interface ServedResponse extends ServedRequest {
  readonly status: number;
  readonly contentType: string | null;
  readonly robots: string | null;
  readonly location: string | null;
  readonly lang: string | null;
  readonly body: string;
}

const HOME_PAGE = { method: "GET", path: "/" };
const MISSING_PAGE = { method: "GET", path: "/esta-pagina-no-existe" };
// Enviar a una ruta sin `action` es un error que React Router responde por
// su cuenta, sin que ninguna ruta lo decida.
const REJECTED_SUBMISSION = { method: "POST", path: "/healthz" };
// La página de muestra de los componentes no existe en producción.
const SAMPLE_PAGE = { method: "GET", path: "/dev/componentes" };
const ENGLISH_HOME = { method: "GET", path: "/en/" };
const SPANISH_PREFIX = { method: "GET", path: "/es/?utm=1" };
const UNSUPPORTED_PREFIX = { method: "GET", path: "/fr/" };
const MISSING_ENGLISH_PAGE = { method: "GET", path: "/en/no-existe" };
// El router decodifica el prefijo, así que esta dirección sirve la home en
// inglés. Su `lang` tiene que coincidir con lo que se pinta.
const ENCODED_ENGLISH_HOME = { method: "GET", path: "/%65n/" };
const UPPERCASE_PREFIX = { method: "GET", path: "/EN/" };
const SERVED_REQUESTS: readonly ServedRequest[] = [
  HOME_PAGE,
  ENGLISH_HOME,
  { method: "GET", path: "/en" },
  ENCODED_ENGLISH_HOME,
  SPANISH_PREFIX,
  UNSUPPORTED_PREFIX,
  MISSING_ENGLISH_PAGE,
  UPPERCASE_PREFIX,
  { method: "HEAD", path: "/" },
  { method: "GET", path: "/healthz" },
  // Las navegaciones del navegador piden los datos de la ruta con `.data`.
  { method: "GET", path: "/_root.data" },
  MISSING_PAGE,
  { method: "GET", path: "/esta-pagina-no-existe.data" },
  REJECTED_SUBMISSION,
  SAMPLE_PAGE,
];

/** Pide cada ruta al servidor ya construido, en un proceso aparte y con el
 * `APP_ENV` que se le pase. Es el mismo manejador que usa `npm run start`. */
function requestFromBuiltServer(appEnv: string): ServedResponse[] {
  const script = `
    import { createRequestHandler } from "react-router";
    const build = await import(${JSON.stringify(pathToFileURL(SERVER_BUNDLE).href)});
    const handle = createRequestHandler(build, "production");
    const served = [];
    for (const { method, path } of ${JSON.stringify(SERVED_REQUESTS)}) {
      const response = await handle(
        new Request("http://localhost" + path, { method, redirect: "manual" }),
      );
      // Se lee el cuerpo entero, como haría un navegador. Una página grande
      // sin leer deja el envío a medias y el proceso espera a que venza.
      const body = await response.text();
      served.push({
        method,
        path,
        location: response.headers.get("Location"),
        lang: /<html lang="([^"]*)"/.exec(body)?.[1] ?? null,
        body,
        status: response.status,
        contentType: response.headers.get("Content-Type"),
        robots: response.headers.get("X-Robots-Tag"),
      });
    }
    process.stdout.write("${RESULT_MARKER}" + JSON.stringify(served));
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...SENTINEL_ENV, APP_ENV: appEnv },
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  const [, json] = result.stdout.split(RESULT_MARKER);
  if (result.status !== 0 || json === undefined) {
    throw new Error(`El servidor no respondió:\n${result.stderr}`);
  }
  return JSON.parse(json) as ServedResponse[];
}

function findServed(
  served: readonly ServedResponse[],
  request: ServedRequest,
): ServedResponse {
  const response = served.find(
    (candidate) =>
      candidate.method === request.method && candidate.path === request.path,
  );
  if (response === undefined) {
    throw new Error(`No se pidió ${request.method} ${request.path}`);
  }
  return response;
}

function describeRobots(served: readonly ServedResponse[]): string[] {
  return served.map(
    ({ method, path, robots }) => `${method} ${path}: ${String(robots)}`,
  );
}

function listExpectedRobots(robots: string | null): string[] {
  return SERVED_REQUESTS.map(
    ({ method, path }) => `${method} ${path}: ${String(robots)}`,
  );
}

describe("X-Robots-Tag en el servidor construido", () => {
  it.each(["local", "test", "staging"])(
    "en %s la llevan las páginas, los datos, /healthz y los errores",
    (appEnv) => {
      const served = requestFromBuiltServer(appEnv);

      expect(describeRobots(served)).toEqual(
        listExpectedRobots("noindex, nofollow"),
      );
    },
  );

  it("en production no la lleva ninguna respuesta", () => {
    const served = requestFromBuiltServer("production");

    expect(describeRobots(served)).toEqual(listExpectedRobots(null));
  });

  it("las peticiones de la prueba cubren una página, un 404 y otro error", () => {
    const served = requestFromBuiltServer("staging");

    expect(findServed(served, HOME_PAGE).status).toBe(200);
    expect(findServed(served, MISSING_PAGE).status).toBe(404);
    expect(findServed(served, REJECTED_SUBMISSION).status).toBe(405);
  });

  it("el 404 sale como página, no como respuesta suelta", () => {
    const served = requestFromBuiltServer("staging");

    expect(findServed(served, MISSING_PAGE).contentType).toContain("text/html");
  });
});

describe("rutas en el servidor construido", () => {
  const served = (): ServedResponse[] => requestFromBuiltServer("staging");

  it("/ responde 200 en español", () => {
    const response = findServed(served(), HOME_PAGE);

    expect([response.status, response.lang]).toEqual([200, "es"]);
  });

  it("/%65n/, con el prefijo codificado, declara el idioma que sirve", () => {
    const response = findServed(served(), ENCODED_ENGLISH_HOME);

    expect([response.status, response.lang]).toEqual([200, "en"]);
  });

  it.each(["/en/", "/en"])("%s responde 200 en inglés", (path) => {
    const response = findServed(served(), { method: "GET", path });

    expect([response.status, response.lang]).toEqual([200, "en"]);
  });

  it("/es/ redirige 301 sin el prefijo y conserva la búsqueda", () => {
    const response = findServed(served(), SPANISH_PREFIX);

    expect([response.status, response.location]).toEqual([301, "/?utm=1"]);
  });

  it("un prefijo no soportado da 404 en español", () => {
    const response = findServed(served(), UNSUPPORTED_PREFIX);

    expect([response.status, response.lang]).toEqual([404, "es"]);
  });

  it("una dirección inexistente bajo /en/ da 404 en inglés", () => {
    const response = findServed(served(), MISSING_ENGLISH_PAGE);

    expect([response.status, response.lang]).toEqual([404, "en"]);
  });

  it("el prefijo en mayúsculas da 404", () => {
    expect(findServed(served(), UPPERCASE_PREFIX).status).toBe(404);
  });

  it("/healthz y /dev/componentes siguen en su dirección", () => {
    const all = served();

    expect(findServed(all, { method: "GET", path: "/healthz" }).status).toBe(
      200,
    );
    expect(findServed(all, SAMPLE_PAGE).status).toBe(200);
  });
});

describe("arranque del servidor", () => {
  it("carga con un entorno completo", () => {
    expect(loadServerBundle(SENTINEL_ENV).exitCode).toBe(0);
  });

  it("no arranca sin variables y las nombra todas", () => {
    const { exitCode, stderr } = loadServerBundle({});

    expect(exitCode).not.toBe(0);
    for (const name of SERVER_ENV_NAMES) {
      expect(stderr).toContain(name);
    }
  });

  it("no arranca con una variable inválida y no imprime ningún valor", () => {
    const { exitCode, stderr } = loadServerBundle({
      ...SENTINEL_ENV,
      APP_ENV: "centinela-entorno-invalido",
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("APP_ENV");
    expect(stderr).not.toContain("centinela");
  });
});

describe("página de muestra en el servidor construido", () => {
  it.each(["local", "test", "staging"])("en %s responde 200", (appEnv) => {
    const served = requestFromBuiltServer(appEnv);

    expect(findServed(served, SAMPLE_PAGE).status).toBe(200);
  });

  it("en production responde 404 como página, no una redirección", () => {
    const served = requestFromBuiltServer("production");
    const response = findServed(served, SAMPLE_PAGE);

    expect(response.status).toBe(404);
    expect(response.contentType).toContain("text/html");
  });
});

const BAD_REQUEST_STATUS = 400;
// Nadie escucha en ese puerto: el action falla rápido al buscar la base, y
// eso basta para saber que la petición llegó hasta él.
const UNREACHABLE_SUPABASE_URL = "http://127.0.0.1:9";

/**
 * Envía el formulario de la página de muestra como llega detrás del proxy
 * del hosting: el proxy termina el HTTPS, así que el servidor ve la petición
 * por http, pero el navegador manda su origen con https.
 */
function submitBehindProxy(host: string, origin: string): number {
  const script = `
    import { createRequestHandler } from "react-router";
    const build = await import(${JSON.stringify(pathToFileURL(SERVER_BUNDLE).href)});
    const handle = createRequestHandler(build, "production");
    const response = await handle(
      new Request(${JSON.stringify(`http://${host}/dev/componentes.data`)}, {
        method: "POST",
        headers: { Origin: ${JSON.stringify(origin)} },
        body: new FormData(),
      }),
    );
    await response.arrayBuffer();
    process.stdout.write("${RESULT_MARKER}" + String(response.status));
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ...SENTINEL_ENV,
        APP_ENV: "staging",
        SUPABASE_URL: UNREACHABLE_SUPABASE_URL,
      },
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  const [, status] = result.stdout.split(RESULT_MARKER);
  if (result.status !== 0 || status === undefined) {
    throw new Error(`El servidor no respondió:\n${result.stderr}`);
  }
  return Number(status);
}

describe("envíos de formulario detrás del proxy", () => {
  it.each([
    "staging.volleytip.com",
    "volleytip.com",
    "www.volleytip.com",
    "production-volleytip.up.railway.app",
  ])("un envío desde https://%s llega al action", (host) => {
    const status = submitBehindProxy(host, `https://${host}`);

    expect(status).not.toBe(BAD_REQUEST_STATUS);
  });

  it("un envío desde un sitio ajeno se rechaza antes del action", () => {
    const status = submitBehindProxy(
      "staging.volleytip.com",
      "https://sitio-ajeno.test",
    );

    expect(status).toBe(BAD_REQUEST_STATUS);
  });

  it("un dominio propio puede enviar a otro dominio propio", () => {
    // Todos sirven la misma app: se acepta a propósito.
    const status = submitBehindProxy(
      "staging.volleytip.com",
      "https://www.volleytip.com",
    );

    expect(status).not.toBe(BAD_REQUEST_STATUS);
  });

  it("la otra dirección que Railway le dio a staging no está en la lista", () => {
    const host = "volleytip-web-staging.up.railway.app";

    const status = submitBehindProxy(host, `https://${host}`);

    expect(status).toBe(BAD_REQUEST_STATUS);
  });

  it("un dominio que solo termina parecido no pasa por propio", () => {
    const status = submitBehindProxy(
      "staging.volleytip.com",
      "https://staging.volleytip.com.sitio-ajeno.test",
    );

    expect(status).toBe(BAD_REQUEST_STATUS);
  });
});

describe("textos por idioma en el servidor construido", () => {
  let served: ServedResponse[] = [];
  beforeAll(() => {
    served = requestFromBuiltServer("production");
  }, BUILD_TIMEOUT_MS);

  it("la home en inglés no contiene frases que solo existen en español", () => {
    const { body } = findServed(served, ENGLISH_HOME);

    expect(body).toContain("Learn volleyball in");
    expect(body).not.toContain("Aprende voley");
    expect(body).not.toContain("Sitio en construcción");
  });

  it("la home en español no contiene los textos en inglés", () => {
    const { body } = findServed(served, HOME_PAGE);

    expect(body).toContain("Aprende voley en");
    expect(body).not.toContain("Learn volleyball");
  });

  it("la página 404 sale en el idioma de la dirección", () => {
    expect(findServed(served, MISSING_PAGE).body).toContain(
      "Esta página no existe.",
    );
    expect(findServed(served, MISSING_ENGLISH_PAGE).body).toContain(
      "This page does not exist.",
    );
  });
});
