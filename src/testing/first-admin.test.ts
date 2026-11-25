import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { runAdminCreate } from "../../scripts/admin-create.ts";
import type { Database } from "~/lib/database.types";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_REF = "proyectodeprueba";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_KEY = "llave-de-servicio-que-nunca-se-imprime";
const EMAIL = "persona@example.com";
const PROFILE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const NEW_USER_ID = "0b8f8a52-3c43-4d0c-9a3a-5d6f2b0f4c11";
const CHILD_TIMEOUT_MS = 30_000;

interface ProfileRow {
  id: string;
  email: string;
  role: "admin" | "staff" | "buyer";
  is_active: boolean;
}

type Failure =
  | "lookup"
  | "createUser"
  | "readUser"
  | "confirm"
  | "update"
  /** La base aplica el cambio y la respuesta se pierde. */
  | "lostUpdateResponse"
  | "audit";

interface FakeProject {
  readonly client: TypedSupabaseClient;
  readonly profiles: ProfileRow[];
  /** Cada petición que escribe, como `MÉTODO /ruta`. */
  readonly writes: string[];
  readonly createdAccounts: unknown[];
  /** Lo que se le cambió a cada cuenta de Auth. */
  readonly accountUpdates: Record<string, unknown>[];
  readonly auditRows: unknown[];
}

function fail(): Response {
  return Response.json({ message: "falló a propósito" }, { status: 500 });
}

/** Un proyecto de Supabase en memoria: contesta lo que Auth y la API
 * contestarían, incluido el perfil que crea el disparador de alta. */
function createFakeProject(
  initialProfiles: readonly ProfileRow[] = [],
  failures: readonly Failure[] = [],
  { isEmailConfirmed = true } = {},
): FakeProject {
  const profiles = initialProfiles.map((profile) => ({ ...profile }));
  const writes: string[] = [];
  const createdAccounts: unknown[] = [];
  const auditRows: unknown[] = [];
  const accountUpdates: Record<string, unknown>[] = [];

  function filterProfiles(url: URL): ProfileRow[] {
    const byId = url.searchParams.get("id")?.replace("eq.", "");
    const byEmail = url.searchParams.get("email")?.replace("eq.", "");
    return profiles.filter(
      (profile) => profile.id === byId || profile.email === byEmail,
    );
  }

  async function createAccount(request: Request): Promise<Response> {
    if (failures.includes("createUser")) return fail();
    const body = (await request.json()) as { email: string };
    createdAccounts.push(body);
    profiles.push({
      id: NEW_USER_ID,
      email: body.email,
      role: "buyer",
      is_active: true,
    });
    return Response.json({ id: NEW_USER_ID, email: body.email });
  }

  async function answerAccount(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return failures.includes("readUser")
        ? fail()
        : Response.json({
            id: PROFILE_ID,
            email_confirmed_at: isEmailConfirmed
              ? "2026-11-01T00:00:00Z"
              : null,
          });
    }
    if (failures.includes("confirm")) return fail();
    accountUpdates.push((await request.json()) as Record<string, unknown>);
    return Response.json({ id: PROFILE_ID });
  }

  async function updateProfile(request: Request, url: URL): Promise<Response> {
    if (failures.includes("update")) return fail();
    const changes = (await request.json()) as Partial<ProfileRow>;
    const [profile] = filterProfiles(url);
    if (profile === undefined) return fail();
    Object.assign(profile, changes);
    if (failures.includes("lostUpdateResponse")) return fail();
    return Response.json({ id: profile.id });
  }

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      writes.push(`${request.method} ${url.pathname}`);
    }
    if (url.pathname === "/auth/v1/admin/users") return createAccount(request);
    if (url.pathname.startsWith("/auth/v1/admin/users/")) {
      return answerAccount(request);
    }
    if (url.pathname === "/rest/v1/audit_log") {
      if (failures.includes("audit")) return fail();
      auditRows.push(await request.json());
      return new Response(null, { status: 201 });
    }
    if (url.pathname !== "/rest/v1/profiles") return fail();
    if (request.method === "PATCH") return updateProfile(request, url);
    return failures.includes("lookup")
      ? fail()
      : Response.json(filterProfiles(url));
  }

  const client = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => answer(new Request(input, init)),
    },
  });
  return {
    client,
    profiles,
    writes,
    createdAccounts,
    accountUpdates,
    auditRows,
  };
}

interface RunOptions {
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly answer?: string;
  readonly project?: FakeProject;
}

interface Run {
  readonly status: number;
  readonly output: string;
  readonly questions: string[];
  readonly clientConfigs: unknown[];
  readonly project: FakeProject;
}

async function run({
  args = [EMAIL],
  env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY },
  answer = PROJECT_REF,
  project = createFakeProject(),
}: RunOptions = {}): Promise<Run> {
  const lines: string[] = [];
  const questions: string[] = [];
  const clientConfigs: unknown[] = [];
  const status = await runAdminCreate({
    args,
    env,
    ask: async (question) => {
      questions.push(question);
      return answer;
    },
    print: (line) => lines.push(line),
    createClient: (config) => {
      clientConfigs.push(config);
      return project.client;
    },
  });
  const output = [...lines, ...questions].join("\n");
  return { status, output, questions, clientConfigs, project };
}

function buildProfile(role: ProfileRow["role"], isActive: boolean): ProfileRow {
  return { id: PROFILE_ID, email: EMAIL, role, is_active: isActive };
}

describe("primer admin: crear", () => {
  it("crea la cuenta con el correo confirmado", async () => {
    const { status, project } = await run();

    expect(status).toBe(0);
    expect(project.createdAccounts).toEqual([
      { email: EMAIL, email_confirm: true },
    ]);
  });

  it("deja el perfil nuevo como admin activo", async () => {
    const { project } = await run();

    expect(project.profiles).toEqual([
      { id: NEW_USER_ID, email: EMAIL, role: "admin", is_active: true },
    ]);
  });

  it("registra en la bitácora, sin actor y con el id del perfil", async () => {
    const { project } = await run();

    expect(project.auditRows).toEqual([
      {
        actor_id: null,
        action: "profile.grant_admin",
        entity: "profile",
        entity_id: NEW_USER_ID,
        details: {
          createdAccount: true,
          confirmedEmail: false,
          previous: null,
        },
      },
    ]);
  });

  it("usa la dirección y la llave del entorno", async () => {
    const { clientConfigs } = await run();

    expect(clientConfigs).toEqual([
      { supabaseUrl: SUPABASE_URL, serviceRoleKey: SERVICE_KEY },
    ]);
  });

  it("dice qué hizo", async () => {
    const { output } = await run();

    expect(output).toContain("Se creó la cuenta");
  });
});

describe("primer admin: subir de rol", () => {
  it.each([
    ["un comprador", buildProfile("buyer", true)],
    ["alguien del staff", buildProfile("staff", true)],
    ["un admin desactivado", buildProfile("admin", false)],
    ["un comprador desactivado", buildProfile("buyer", false)],
  ])("deja a %s como admin activo sin duplicar", async (_case, profile) => {
    const project = createFakeProject([profile]);

    const { status } = await run({ project });

    expect(status).toBe(0);
    expect(project.createdAccounts).toEqual([]);
    expect(project.profiles).toEqual([buildProfile("admin", true)]);
  });

  it("registra el rol y el estado que tenía", async () => {
    const project = createFakeProject([buildProfile("staff", false)]);

    await run({ project });

    expect(project.auditRows).toEqual([
      {
        actor_id: null,
        action: "profile.grant_admin",
        entity: "profile",
        entity_id: PROFILE_ID,
        details: {
          createdAccount: false,
          confirmedEmail: false,
          previous: { role: "staff", isActive: false },
        },
      },
    ]);
  });

  it("a un admin activo no lo cambia ni registra nada, y lo dice", async () => {
    const project = createFakeProject([buildProfile("admin", true)]);

    const { status, output } = await run({ project });

    expect(status).toBe(0);
    expect(output).toContain("ya es admin activo");
    expect(project.writes).toEqual([]);
  });
});

describe("primer admin: cuenta sin confirmar", () => {
  function createUnconfirmed(profile: ProfileRow): FakeProject {
    return createFakeProject([profile], [], { isEmailConfirmed: false });
  }

  it.each([
    ["un comprador", buildProfile("buyer", true)],
    ["quien ya es admin activo", buildProfile("admin", true)],
  ])("a %s le confirma el correo y lo deja admin", async (_case, profile) => {
    const project = createUnconfirmed(profile);

    const { status } = await run({ project });

    expect(status).toBe(0);
    expect(project.accountUpdates).toEqual([
      expect.objectContaining({ email_confirm: true }),
    ]);
    expect(project.profiles).toEqual([buildProfile("admin", true)]);
    expect(project.auditRows).toEqual([
      expect.objectContaining({
        details: expect.objectContaining({ confirmedEmail: true }),
      }),
    ]);
  });

  // Quien haya registrado ese correo antes conoce la contraseña: confirmar
  // la cuenta sin cambiarla le abriría el panel.
  it("le cambia la contraseña por una al azar que no se imprime", async () => {
    const first = createUnconfirmed(buildProfile("buyer", true));
    const second = createUnconfirmed(buildProfile("buyer", true));

    const { output } = await run({ project: first });
    await run({ project: second });

    const password = String(first.accountUpdates[0]?.password);
    expect(password.length).toBeGreaterThanOrEqual(32);
    expect(second.accountUpdates[0]?.password).not.toBe(password);
    expect(output).not.toContain(password);
  });

  it("dice que confirmó el correo y cambió la contraseña", async () => {
    const project = createUnconfirmed(buildProfile("admin", true));

    const { output } = await run({ project });

    expect(output).toContain("Se confirmó su correo");
    expect(output).toContain("contraseña");
  });
});

// Con el registro abierto, un tercero pudo crear la cuenta con ese correo y
// confirmarla: al subirla a admin no puede conservar su contraseña.
describe("primer admin: contraseña de una cuenta que ya existía", () => {
  it.each([
    ["un comprador", buildProfile("buyer", true)],
    ["alguien del staff", buildProfile("staff", true)],
    ["un admin desactivado", buildProfile("admin", false)],
  ])("a %s confirmado se la cambia y lo dice", async (_case, profile) => {
    const project = createFakeProject([profile]);

    const { output } = await run({ project });

    expect(project.accountUpdates).toEqual([
      { email_confirm: true, password: expect.any(String) },
    ]);
    expect(output).toContain("contraseña");
    expect(output).not.toContain("Se confirmó su correo");
  });

  it("a un admin activo y confirmado no le toca la cuenta", async () => {
    const project = createFakeProject([buildProfile("admin", true)]);

    await run({ project });

    expect(project.accountUpdates).toEqual([]);
  });
});

describe("primer admin: confirmación", () => {
  it("muestra el proyecto al que va a escribir y pide su identificador", async () => {
    const { output, questions } = await run();

    expect(output).toContain(SUPABASE_URL);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain(PROJECT_REF);
  });

  it("en una base local pide el host con su puerto", async () => {
    const { status } = await run({
      env: {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
      answer: "127.0.0.1:54321",
    });

    expect(status).toBe(0);
  });

  it.each(["", "si", "s", "otroproyecto", `${PROJECT_REF}x`])(
    "con la respuesta %j no escribe nada y sale con error",
    async (answer) => {
      const { status, project, output } = await run({ answer });

      expect(status).not.toBe(0);
      expect(project.writes).toEqual([]);
      expect(output).toContain("No se escribió nada");
    },
  );

  it("acepta el identificador con espacios alrededor", async () => {
    const { status } = await run({ answer: `  ${PROJECT_REF} ` });

    expect(status).toBe(0);
  });
});

describe("primer admin: entradas inválidas", () => {
  it.each([
    ["ausente", []],
    ["vacío", [""]],
    ["solo espacios", ["   "]],
    ["sin arroba", ["persona.example.com"]],
    ["sin dominio", ["persona@"]],
    ["con espacios en medio", ["per sona@example.com"]],
    ["acompañado de otro", [EMAIL, "otra@example.com"]],
  ])(
    "con un correo %s explica el uso y no escribe nada",
    async (_case, args) => {
      const { status, output, questions, project } = await run({ args });

      expect(status).not.toBe(0);
      expect(output).toContain("npm run admin:create -- correo");
      expect(questions).toEqual([]);
      expect(project.writes).toEqual([]);
    },
  );

  it("normaliza mayúsculas y espacios", async () => {
    const { project } = await run({ args: ["  Persona@Example.COM  "] });

    expect(project.createdAccounts).toEqual([
      { email: EMAIL, email_confirm: true },
    ]);
  });

  it("encuentra el perfil existente aunque el correo venga en mayúsculas", async () => {
    const project = createFakeProject([buildProfile("buyer", true)]);

    await run({ project, args: [EMAIL.toUpperCase()] });

    expect(project.createdAccounts).toEqual([]);
  });

  it.each([
    ["SUPABASE_URL", { SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }],
    ["SUPABASE_SERVICE_ROLE_KEY", { SUPABASE_URL }],
    [
      "SUPABASE_SERVICE_ROLE_KEY",
      { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "  " },
    ],
  ])("dice que falta %s sin imprimir valores", async (name, env) => {
    const { status, output, project } = await run({ env });

    expect(status).not.toBe(0);
    expect(output).toContain(`Falta ${name}`);
    expect(output).not.toContain(SERVICE_KEY);
    expect(output).not.toContain(SUPABASE_URL);
    expect(project.writes).toEqual([]);
  });

  it("nombra las dos variables cuando faltan ambas", async () => {
    const { output } = await run({ env: {} });

    expect(output).toContain("Falta SUPABASE_URL");
    expect(output).toContain("Falta SUPABASE_SERVICE_ROLE_KEY");
  });

  it.each([
    `http://${PROJECT_REF}.supabase.co`,
    "http://127.0.0.1.example.com",
  ])("no manda la llave sin cifrar a %s", async (url) => {
    const { status, output, questions, clientConfigs } = await run({
      env: { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY },
    });

    expect(status).not.toBe(0);
    expect(output).toContain("https");
    expect(questions).toEqual([]);
    expect(clientConfigs).toEqual([]);
  });

  it.each(["localhost:54321", "[::1]:54321"])(
    "acepta http en la propia máquina (%s)",
    async (host) => {
      const { status } = await run({
        env: {
          SUPABASE_URL: `http://${host}`,
          SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        },
        answer: host,
      });

      expect(status).toBe(0);
    },
  );

  it("rechaza una dirección que no es una URL sin imprimirla", async () => {
    const { status, output } = await run({
      env: {
        SUPABASE_URL: SERVICE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
    });

    expect(status).not.toBe(0);
    expect(output).toContain("SUPABASE_URL");
    expect(output).not.toContain(SERVICE_KEY);
  });

  it("no imprime la llave aunque un error la traiga en su mensaje", async () => {
    const lines: string[] = [];

    const status = await runAdminCreate({
      args: [EMAIL],
      env: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY },
      ask: async () => PROJECT_REF,
      print: (line) => lines.push(line),
      createClient: () => {
        throw new Error(`cabecera inválida: Bearer ${SERVICE_KEY}`);
      },
    });

    expect(status).not.toBe(0);
    expect(lines.join("\n")).toContain("cabecera inválida");
    expect(lines.join("\n")).not.toContain(SERVICE_KEY);
  });

  it("nunca imprime la llave en una ejecución normal", async () => {
    const { output } = await run();

    expect(output).not.toContain(SERVICE_KEY);
  });
});

describe("primer admin: fallos de Supabase", () => {
  it.each<[Failure, string]>([
    ["lookup", "No se pudo buscar el perfil"],
    ["createUser", "No se pudo crear la cuenta"],
  ])("si falla %s lo dice y no registra nada", async (failure, message) => {
    const project = createFakeProject([], [failure]);

    const { status, output } = await run({ project });

    expect(status).not.toBe(0);
    expect(output).toContain(message);
    expect(project.auditRows).toEqual([]);
  });

  it.each<[Failure, string]>([
    ["readUser", "No se pudo leer la cuenta"],
    ["confirm", "No se pudo cambiar el acceso"],
  ])("si falla %s no cambia el rol", async (failure, message) => {
    const project = createFakeProject(
      [buildProfile("buyer", true)],
      [failure],
      { isEmailConfirmed: false },
    );

    const { status, output } = await run({ project });

    expect(status).not.toBe(0);
    expect(output).toContain(message);
    expect(project.profiles).toEqual([buildProfile("buyer", true)]);
  });

  it("si falla la creación avisa que la cuenta pudo quedar creada", async () => {
    const project = createFakeProject([], ["createUser"]);

    const { output } = await run({ project });

    expect(output).toContain("Puede que la cuenta haya quedado creada");
    expect(output).toContain("Repite el comando");
  });

  it("si la bitácora falla, no cambia nada y dice por qué", async () => {
    const project = createFakeProject(
      [buildProfile("staff", false)],
      ["audit"],
    );

    const { status, output } = await run({ project });

    expect(status).not.toBe(0);
    expect(output).toContain("bitácora: falló a propósito");
    expect(project.profiles).toEqual([buildProfile("staff", false)]);
  });

  it("si la bitácora falla con una cuenta nueva, avisa que quedó creada", async () => {
    const project = createFakeProject([], ["audit"]);

    const { status, output } = await run({ project });

    expect(status).not.toBe(0);
    expect(output).toContain("La cuenta quedó creada");
    expect(output).toContain(NEW_USER_ID);
    expect(project.profiles[0]?.role).toBe("buyer");
  });

  it.each<Failure>(["update", "lostUpdateResponse"])(
    "con %s la entrada ya está en la bitácora y pide repetir",
    async (failure) => {
      const project = createFakeProject(
        [buildProfile("buyer", true)],
        [failure],
      );

      const { status, output } = await run({ project });

      expect(status).not.toBe(0);
      expect(output).toContain("Repite el comando");
      expect(output).toContain("falló a propósito");
      expect(project.auditRows).toHaveLength(1);
    },
  );
});

describe("primer admin: el comando", () => {
  function runCommand(
    args: readonly string[],
    env: Record<string, string>,
    input = "",
  ): { status: number | null; output: string } {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/admin-create.ts", ...args],
      {
        cwd: REPO_ROOT,
        // Solo lo que se pasa: el comando no necesita el resto del entorno
        // del servidor.
        env: { PATH: process.env.PATH, ...env },
        input,
        encoding: "utf8",
        timeout: CHILD_TIMEOUT_MS,
      },
    );
    return { status: result.status, output: result.stdout + result.stderr };
  }

  it("package.json lo declara como admin:create", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(manifest.scripts["admin:create"]).toBe(
      "node --env-file-if-exists=.env.local --experimental-strip-types scripts/admin-create.ts",
    );
  });

  it("sin correo explica el uso", () => {
    const { status, output } = runCommand([], {});

    expect(status).toBe(1);
    expect(output).toContain("npm run admin:create -- correo");
  });

  it.each([
    ["otra respuesta", "no\n"],
    ["la entrada cerrada", ""],
  ])("con %s termina con error sin escribir", (_case, input) => {
    const { status, output } = runCommand(
      [EMAIL],
      { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY },
      input,
    );

    expect(status).toBe(1);
    expect(output).toContain(PROJECT_REF);
    expect(output).toContain("No se escribió nada");
    expect(output).not.toContain(SERVICE_KEY);
  });
});
