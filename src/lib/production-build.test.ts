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

interface ServedResponse {
  readonly path: string;
  readonly status: number;
  readonly robots: string | null;
}

const HOME_PATH = "/";
const HEALTHZ_PATH = "/healthz";
const MISSING_PATH = "/esta-pagina-no-existe";
const SERVED_PATHS = [HOME_PATH, HEALTHZ_PATH, MISSING_PATH];

/** Pide cada ruta al servidor ya construido, en un proceso aparte y con el
 * `APP_ENV` que se le pase. Es el mismo manejador que usa `npm run start`. */
function requestFromBuiltServer(appEnv: string): ServedResponse[] {
  const script = `
    import { createRequestHandler } from "react-router";
    const build = await import(${JSON.stringify(pathToFileURL(SERVER_BUNDLE).href)});
    const handle = createRequestHandler(build, "production");
    const served = [];
    for (const path of ${JSON.stringify(SERVED_PATHS)}) {
      const response = await handle(new Request("http://localhost" + path));
      served.push({
        path,
        status: response.status,
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
  path: string,
): ServedResponse {
  const response = served.find((candidate) => candidate.path === path);
  if (response === undefined) {
    throw new Error(`No se pidió ${path}`);
  }
  return response;
}

describe("X-Robots-Tag en el servidor construido", () => {
  it.each(["local", "test", "staging"])(
    "en %s la llevan la página, /healthz y el 404",
    (appEnv) => {
      const served = requestFromBuiltServer(appEnv);

      expect(findServed(served, HOME_PATH).status).toBe(200);
      expect(findServed(served, MISSING_PATH).status).toBe(404);
      expect(served.map((response) => response.robots)).toEqual(
        SERVED_PATHS.map(() => "noindex, nofollow"),
      );
    },
  );

  it("en production no la lleva ninguna respuesta", () => {
    const served = requestFromBuiltServer("production");

    expect(findServed(served, MISSING_PATH).status).toBe(404);
    expect(served.map((response) => response.robots)).toEqual(
      SERVED_PATHS.map(() => null),
    );
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
