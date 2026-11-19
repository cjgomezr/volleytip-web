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
} as const;
const SECRET_SENTINELS = [
  SENTINEL_ENV.SUPABASE_URL,
  SENTINEL_ENV.SUPABASE_ANON_KEY,
  SENTINEL_ENV.SUPABASE_SERVICE_ROLE_KEY,
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
}

const HOME_PAGE = { method: "GET", path: "/" };
const MISSING_PAGE = { method: "GET", path: "/esta-pagina-no-existe" };
// Enviar a una ruta sin `action` es un error que React Router responde por
// su cuenta, sin que ninguna ruta lo decida.
const REJECTED_SUBMISSION = { method: "POST", path: "/healthz" };
const SERVED_REQUESTS: readonly ServedRequest[] = [
  HOME_PAGE,
  { method: "HEAD", path: "/" },
  { method: "GET", path: "/healthz" },
  // Las navegaciones del navegador piden los datos de la ruta con `.data`.
  { method: "GET", path: "/_root.data" },
  MISSING_PAGE,
  { method: "GET", path: "/esta-pagina-no-existe.data" },
  REJECTED_SUBMISSION,
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
        new Request("http://localhost" + path, { method }),
      );
      served.push({
        method,
        path,
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

function expectRobotsOnEveryRequest(robots: string | null): string[] {
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
        expectRobotsOnEveryRequest("noindex, nofollow"),
      );
    },
  );

  it("en production no la lleva ninguna respuesta", () => {
    const served = requestFromBuiltServer("production");

    expect(describeRobots(served)).toEqual(expectRobotsOnEveryRequest(null));
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
