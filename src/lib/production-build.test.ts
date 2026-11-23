import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
// Cada corrida construye en su propia carpeta. Con una sola carpeta `build/`,
// dos corridas a la vez (el Stop gate y un revisor, o dos workers) se borraban
// el build una a la otra y la prueba fallaba sin que nada estuviera roto.
// Va dentro de `node_modules` para que el servidor construido encuentre sus
// dependencias y para que ni git, ni el lint, ni Vitest la miren.
const BUILD_DIRECTORY = `node_modules/.cache/production-build-test/${String(process.pid)}`;
const BUILD_ROOT = path.join(REPO_ROOT, BUILD_DIRECTORY);
const CLIENT_BUILD = path.join(BUILD_ROOT, "client");
const SERVER_BUNDLE = path.join(BUILD_ROOT, "server/index.js");
// En Windows un proceso recién cerrado puede tardar en soltar la carpeta.
const REMOVE_BUILD_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 200,
} as const;
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
  SITE_ORIGIN: true,
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
  // Distinto de la dirección con la que se pide en estas pruebas.
  SITE_ORIGIN: "https://sitio-construido.volleytip.test",
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
    env: { ...process.env, ...SENTINEL_ENV, BUILD_DIRECTORY },
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
afterAll(() => rmSync(BUILD_ROOT, REMOVE_BUILD_OPTIONS));

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
const ENGLISH_HOME_SEARCH = { method: "GET", path: "/en/?talla=m" };
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
  ENGLISH_HOME_SEARCH,
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
function requestFromBuiltServer(
  appEnv: string,
  requests: readonly ServedRequest[] = SERVED_REQUESTS,
): ServedResponse[] {
  return runBuiltServer(appEnv, requests).served;
}

function runBuiltServer(
  appEnv: string,
  requests: readonly ServedRequest[],
): { readonly served: ServedResponse[]; readonly serverLog: string } {
  const script = `
    import { createRequestHandler } from "react-router";
    const build = await import(${JSON.stringify(pathToFileURL(SERVER_BUNDLE).href)});
    const handle = createRequestHandler(build, "production");
    // Todas a la vez: cada página espera a la base por la barra de anuncios
    // hasta su límite, y aquí la base no existe. De una en una, la suma de
    // esas esperas se come el tiempo de la prueba.
    const serve = async ({ method, path }) => {
      const response = await handle(
        new Request("http://localhost" + path, { method, redirect: "manual" }),
      );
      // Se lee el cuerpo entero, como haría un navegador. Una página grande
      // sin leer deja el envío a medias y el proceso espera a que venza.
      const body = await response.text();
      return {
        method,
        path,
        location: response.headers.get("Location"),
        lang: /<html lang="([^"]*)"/.exec(body)?.[1] ?? null,
        body,
        status: response.status,
        contentType: response.headers.get("Content-Type"),
        robots: response.headers.get("X-Robots-Tag"),
      };
    };
    const served = await Promise.all(${JSON.stringify(requests)}.map(serve));
    // Sale en cuanto escribe: las consultas a la base que ya nadie espera
    // siguen reintentando y dejarían vivo el proceso.
    process.stdout.write("${RESULT_MARKER}" + JSON.stringify(served), () => {
      process.exit(0);
    });
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
  return {
    served: JSON.parse(json) as ServedResponse[],
    serverLog: result.stderr,
  };
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
// Una petición que llega al action arranca el servidor en otro proceso y,
// antes, espera lo que tarde la lectura de ajustes contra esa base inalcanzable
// (hasta SITE_SETTINGS_TIMEOUT_MS). Cabe de sobra en este límite.
const REACHES_ACTION_TEST_TIMEOUT_MS = 20_000;

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
  ])(
    "un envío desde https://%s llega al action",
    (host) => {
      const status = submitBehindProxy(host, `https://${host}`);

      expect(status).not.toBe(BAD_REQUEST_STATUS);
    },
    REACHES_ACTION_TEST_TIMEOUT_MS,
  );

  it("un envío desde un sitio ajeno se rechaza antes del action", () => {
    const status = submitBehindProxy(
      "staging.volleytip.com",
      "https://sitio-ajeno.test",
    );

    expect(status).toBe(BAD_REQUEST_STATUS);
  });

  it(
    "un dominio propio puede enviar a otro dominio propio",
    () => {
      // Todos sirven la misma app: se acepta a propósito.
      const status = submitBehindProxy(
        "staging.volleytip.com",
        "https://www.volleytip.com",
      );

      expect(status).not.toBe(BAD_REQUEST_STATUS);
    },
    REACHES_ACTION_TEST_TIMEOUT_MS,
  );

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
    expect(findServed(served, MISSING_PAGE).body).toContain("Balón fuera");
    expect(findServed(served, MISSING_ENGLISH_PAGE).body).toContain(
      "Out of bounds",
    );
  });
});

// React Router rechaza un método como OPTIONS antes de correr ningún loader,
// así que la página de error se pinta sin los datos de la raíz. Tiene que
// salir igual, y en el idioma de la dirección.
describe("página de error cuando la raíz no tiene datos", () => {
  const REJECTED_METHOD = { method: "OPTIONS", path: "/" };
  const REJECTED_METHOD_IN_ENGLISH = { method: "OPTIONS", path: "/en/" };
  const served = (): ServedResponse[] =>
    requestFromBuiltServer("staging", [
      REJECTED_METHOD,
      REJECTED_METHOD_IN_ENGLISH,
    ]);

  it("sale como página en español, no como un error sin formato", () => {
    const response = findServed(served(), REJECTED_METHOD);

    expect(response.lang).toBe("es");
    expect(response.body).toContain("No pudimos mostrar esta página");
    expect(response.body).not.toContain("Unexpected Server Error");
  });

  it("bajo /en/ sale en inglés", () => {
    const response = findServed(served(), REJECTED_METHOD_IN_ENGLISH);

    expect(response.lang).toBe("en");
    expect(response.body).toContain("We could not show this page");
    expect(response.body).not.toContain("Unexpected Server Error");
  });
});

describe("página 500 en el servidor construido", () => {
  const FAILING_PAGE = { method: "GET", path: "/dev/fallo" };
  const FORBIDDEN_PAGE = { method: "GET", path: "/dev/fallo?estado=403" };
  const ENGLISH_FAILING_PAGE = { method: "GET", path: "/en/dev/fallo" };
  const SECRET_MESSAGE = "detalle-tecnico-secreto";
  // Un solo arranque del servidor para todo el bloque.
  let cached: ReturnType<typeof runBuiltServer> | undefined;
  const run = (): ReturnType<typeof runBuiltServer> => {
    cached ??= runBuiltServer("staging", [
      FAILING_PAGE,
      FORBIDDEN_PAGE,
      ENGLISH_FAILING_PAGE,
    ]);
    return cached;
  };

  it("un loader que lanza responde 500 con 'Pedimos tiempo' y sin la cáscara", () => {
    const response = findServed(run().served, FAILING_PAGE);

    expect(response.status).toBe(500);
    expect(response.body).toMatch(/<h1[^>]*>Pedimos tiempo/);
    expect(response.body).not.toContain("<header");
  });

  it("el código de referencia del HTML es el que quedó en el registro", () => {
    const { served, serverLog } = run();
    const body = findServed(served, FAILING_PAGE).body;

    const code = /Código de referencia(?:[\s:]|<[^>]*>)*([0-9A-F]{8})/.exec(
      body,
    )?.[1];

    expect(code).toBeDefined();
    expect(serverLog).toContain(`referencia ${code}`);
  });

  it("no muestra el mensaje del error ni la traza, tampoco en el HTML", () => {
    const { body } = findServed(run().served, FAILING_PAGE);

    expect(body).not.toContain(SECRET_MESSAGE);
    expect(body).not.toMatch(/\n\s+at /);
  });

  it("sale en inglés bajo /en/ y no se indexa", () => {
    const response = findServed(run().served, ENGLISH_FAILING_PAGE);

    expect(response.body).toMatch(/<h1[^>]*>Timeout called/);
    expect(response.robots).toContain("noindex");
  });

  it("un 403 controlado conserva su estado y no dice 500", () => {
    const response = findServed(run().served, FORBIDDEN_PAGE);

    expect(response.status).toBe(403);
    expect(response.body).toMatch(/<h1[^>]*>No pudimos mostrar esta página/);
  });
});

describe("head en el servidor construido", () => {
  // Las peticiones de esta prueba llegan por `http` y con `Host: localhost`,
  // como las ve el servidor detrás del proxy. Las direcciones tienen que
  // salir de `SITE_ORIGIN`.
  const ORIGIN = SENTINEL_ENV.SITE_ORIGIN;
  const served = (): ServedResponse[] => requestFromBuiltServer("staging");

  function headOf(response: ServedResponse): string {
    const [head] = response.body.split("</head>");
    return head ?? "";
  }

  function listLinks(response: ServedResponse): string[] {
    const links = headOf(response).matchAll(
      /<link rel="(canonical|alternate)"(?: hrefLang="([^"]*)")? href="([^"]*)"\/>/g,
    );
    return [...links].map(
      ([, rel, hreflang, href]) => `${rel} ${hreflang ?? "-"} ${href}`,
    );
  }

  it("/ trae su canónica y sus hreflang con SITE_ORIGIN, dentro del head", () => {
    expect(listLinks(findServed(served(), HOME_PAGE))).toEqual([
      `canonical - ${ORIGIN}/`,
      `alternate es ${ORIGIN}/`,
      `alternate en ${ORIGIN}/en/`,
      `alternate x-default ${ORIGIN}/`,
    ]);
  });

  it.each([ENGLISH_HOME, { method: "GET", path: "/en" }, ENGLISH_HOME_SEARCH])(
    "$path trae la canónica en inglés, sin parámetros de búsqueda",
    (request) => {
      expect(listLinks(findServed(served(), request))).toEqual([
        `canonical - ${ORIGIN}/en/`,
        `alternate es ${ORIGIN}/`,
        `alternate en ${ORIGIN}/en/`,
        `alternate x-default ${ORIGIN}/`,
      ]);
    },
  );

  it("ninguna dirección sale de la petición", () => {
    const body = findServed(served(), ENGLISH_HOME_SEARCH).body;

    expect(body).not.toContain('href="http://localhost');
    expect(headOf(findServed(served(), ENGLISH_HOME_SEARCH))).not.toContain(
      "talla",
    );
    expect(body).toContain(ORIGIN);
  });

  it.each([MISSING_PAGE, MISSING_ENGLISH_PAGE, UNSUPPORTED_PREFIX])(
    "el 404 de $path no lleva canónica ni hreflang",
    (request) => {
      const response = findServed(served(), request);

      expect(response.status).toBe(404);
      expect(response.body).not.toContain('rel="canonical"');
      expect(response.body).not.toContain('rel="alternate"');
    },
  );

  it("la página de muestra, que no es del sitio, tampoco las lleva", () => {
    const response = findServed(served(), SAMPLE_PAGE);

    expect(response.body).not.toContain('rel="canonical"');
    expect(response.body).not.toContain('rel="alternate"');
  });
});

const SERVICE_UNAVAILABLE_STATUS = 503;
const FAKE_SETTINGS_PORT = 54399;

interface MaintenanceResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * Pide una página al servidor construido, con una base falsa que responde que
 * el modo mantenimiento está encendido. Prueba el documento real de punta a
 * punta: estado, cabeceras y página pintada por la raíz.
 */
function requestWhileInMaintenance(
  pathname: string,
  method = "GET",
): MaintenanceResponse {
  const script = `
    import http from "node:http";
    import { createRequestHandler } from "react-router";
    const settings = [{ key: "maintenance_mode", value: { enabled: true } }];
    const fakeDatabase = http.createServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(settings));
    });
    await new Promise((resolve) => fakeDatabase.listen(${FAKE_SETTINGS_PORT}, "127.0.0.1", resolve));
    const build = await import(${JSON.stringify(pathToFileURL(SERVER_BUNDLE).href)});
    const handle = createRequestHandler(build, "production");
    const response = await handle(
      new Request(${JSON.stringify(`http://localhost${pathname}`)}, { method: ${JSON.stringify(method)}, ${method === "POST" ? 'headers: { Origin: "http://localhost" }, body: new FormData(),' : ""} }),
    );
    const body = await response.text();
    fakeDatabase.close();
    process.stdout.write("${RESULT_MARKER}" + JSON.stringify({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body,
    }));
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ...SENTINEL_ENV,
        APP_ENV: "production",
        SUPABASE_URL: `http://127.0.0.1:${FAKE_SETTINGS_PORT}`,
      },
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  const [, json] = result.stdout.split(RESULT_MARKER);
  if (result.status !== 0 || json === undefined) {
    throw new Error(`El servidor no respondió:\n${result.stderr}`);
  }
  return JSON.parse(json) as MaintenanceResponse;
}

describe("modo mantenimiento en el servidor construido", () => {
  it("responde 503 con la página y las cabeceras de mantenimiento", () => {
    const response = requestWhileInMaintenance("/tienda");

    expect(response.status).toBe(SERVICE_UNAVAILABLE_STATUS);
    expect(response.body).toContain("Estamos calentando");
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.headers["x-robots-tag"]).toBe("noindex");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("sale en inglés bajo /en/", () => {
    const response = requestWhileInMaintenance("/en/no-existe");

    expect(response.status).toBe(SERVICE_UNAVAILABLE_STATUS);
    expect(response.body).toContain("We are warming up");
  });

  it("responde 503 a un POST", () => {
    const response = requestWhileInMaintenance("/dev/componentes", "POST");

    expect(response.status).toBe(SERVICE_UNAVAILABLE_STATUS);
  });

  it("deja libre /healthz", () => {
    const response = requestWhileInMaintenance("/healthz");

    expect(response.status).toBe(200);
  });
});
