import type { RouteConfigEntry } from "@react-router/dev/routes";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_MODULES } from "~/lib/admin/modules";
import { buildPanelNavigation } from "~/lib/admin/navigation";
import type { Language } from "~/lib/i18n/languages";
import { getMessages } from "~/lib/i18n/messages.server";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import {
  panelSessionContext,
  requireAdmin,
  requirePanelMember,
} from "~/lib/panel/panel-middleware.server";
import { createSessionSupabaseClient } from "~/lib/supabase/session-client.server";
import routes from "~/routes";
import {
  createAuditApi,
  type FakeAuditActor,
  type FakeAuditApi,
  type FakeAuditData,
  type FakeAuditEntry,
} from "~/testing/fake-audit-api";
import { buildSessionCookie, stubSupabase } from "~/testing/fake-supabase";

import { TEST_ENV } from "../../../tests/support/test-env";
import * as adminLayout from "./admin-layout";
import * as listRoute from "./audit-log";
import * as entryRoute from "./audit-log-entry";

const ANDRES: FakeAuditActor = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  full_name: "Andrés Gómez",
  email: "andres@prueba.volleytip.test",
};
const UNNAMED: FakeAuditActor = {
  id: "9b2c1f3a-1111-4222-8333-944455556666",
  full_name: "  ",
  email: "sin.nombre@prueba.volleytip.test",
};
const ENTRY_ID = "1d3c5b7a-2222-4333-8444-955566667777";
const SIGNED_IN = buildSessionCookie(TEST_ENV.SUPABASE_URL);

function buildEntry(overrides: Partial<FakeAuditEntry> = {}): FakeAuditEntry {
  return {
    id: ENTRY_ID,
    action: "faq.publish",
    entity: "faq",
    entity_id: "5a6b7c8d-3333-4444-8555-966677778888",
    details: {},
    // Las 9:30 p. m. del 24 en Colombia: en UTC ya es el 25.
    created_at: "2026-11-25T02:30:00Z",
    actor: { full_name: ANDRES.full_name, email: ANDRES.email },
    ...overrides,
  };
}

const OPTIONS: FakeAuditData = {
  actors: [ANDRES, UNNAMED],
  actions: ["faq.publish", "profile.set_locale"],
};

function serve(data: FakeAuditData): FakeAuditApi {
  const api = createAuditApi({ ...OPTIONS, ...data });
  vi.stubGlobal("fetch", api.fetch);
  return api;
}

function buildArgs<Args>(
  path: string,
  params: Record<string, string> = {},
): Args {
  const request = new Request(`http://localhost${path}`, {
    headers: { Cookie: SIGNED_IN },
  });
  const context = new RouterContextProvider();
  context.set(panelSessionContext, createSessionSupabaseClient(request));
  return { request, context, params } as unknown as Args;
}

function loadList(
  path = "/admin/bitacora",
): ReturnType<typeof listRoute.loader> {
  return listRoute.loader(buildArgs(path));
}

function loadEntry(
  path = `/admin/bitacora/${ENTRY_ID}`,
  id = ENTRY_ID,
): ReturnType<typeof entryRoute.loader> {
  return entryRoute.loader(buildArgs(path, { id }));
}

function render(element: ReactElement, language: Language = "es"): string {
  const path = getPanelPath("adminAuditLog", language);
  const Stub = createRoutesStub([
    {
      path,
      Component: () => (
        <TranslationsProvider
          language={language}
          messages={getMessages(language)}
        >
          {element}
        </TranslationsProvider>
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={[path]} />);
}

async function renderList(
  path = "/admin/bitacora",
  language: Language = "es",
): Promise<string> {
  const view = await loadList(path);
  return render(<listRoute.AuditLogPage {...view} />, language);
}

async function renderEntry(details: unknown): Promise<string> {
  serve({ entries: [buildEntry({ details })] });
  const view = await loadEntry();
  return render(<entryRoute.AuditEntryPage {...view} />);
}

function listRequests(api: FakeAuditApi): FakeAuditApi["requests"] {
  return api.requests.filter(({ url }) => url.pathname.endsWith("/audit_log"));
}

/** Los parámetros con que se pidieron las filas a la base. */
function rowQuery(api: FakeAuditApi): URLSearchParams {
  const request = listRequests(api).find(({ method }) => method === "GET");
  if (request === undefined) throw new Error("No se pidieron las entradas");
  return request.url.searchParams;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bitácora: lista", () => {
  it("pide las entradas de la más reciente a la más antigua", async () => {
    const api = serve({ entries: [buildEntry()] });

    await loadList();

    expect(rowQuery(api).get("order")).toBe("created_at.desc,id.desc");
  });

  it("pinta las entradas en el orden en que las da la base", async () => {
    serve({
      entries: [
        buildEntry({ action: "faq.publish" }),
        buildEntry({ id: "otra", action: "profile.set_locale" }),
      ],
    });

    const { entries } = await loadList();

    expect(entries.map(({ action }) => action)).toEqual([
      "faq.publish",
      "profile.set_locale",
    ]);
  });

  it("trae 50 por página", async () => {
    const api = serve({ entries: [buildEntry()], total: 120 });

    const { pagination } = await loadList();

    expect(rowQuery(api).get("offset")).toBe("0");
    expect(rowQuery(api).get("limit")).toBe("50");
    expect(pagination).toMatchObject({ page: 1, pageCount: 3 });
    expect(pagination.previousHref).toBeUndefined();
    expect(pagination.nextHref).toBe("/admin/bitacora?pagina=2");
  });

  it("la página vive en la dirección y la resuelve el servidor", async () => {
    const api = serve({ entries: [buildEntry()], total: 120 });

    const { pagination } = await loadList("/admin/bitacora?pagina=3");

    expect(rowQuery(api).get("offset")).toBe("100");
    expect(pagination.previousHref).toBe("/admin/bitacora?pagina=2");
    expect(pagination.nextHref).toBeUndefined();
  });

  it.each(["0", "-1", "abc", "1.5", "99999999999999999999"])(
    "una página mal escrita (%s) es la primera",
    async (page) => {
      const api = serve({ entries: [buildEntry()], total: 120 });

      const { pagination } = await loadList(`/admin/bitacora?pagina=${page}`);

      expect(pagination.page).toBe(1);
      expect(rowQuery(api).get("offset")).toBe("0");
    },
  );

  it("una página que se pasa del final es la última", async () => {
    const api = serve({ entries: [buildEntry()], total: 120 });

    const { pagination } = await loadList("/admin/bitacora?pagina=40");

    expect(pagination.page).toBe(3);
    expect(rowQuery(api).get("offset")).toBe("100");
  });

  it("muestra fecha y hora de Colombia, quién, acción y entidad", async () => {
    serve({ entries: [buildEntry()] });

    const html = await renderList();

    expect(html).toContain("24/11/26");
    expect(html).toMatch(/9:30/);
    expect(html).toContain('dateTime="2026-11-25T02:30:00Z"');
    expect(html).toContain("Andrés Gómez");
    expect(html).toContain("faq.publish");
    expect(html).toContain("Entidad: faq");
  });

  it("en inglés la fecha sale con el formato en inglés", async () => {
    serve({ entries: [buildEntry()] });

    const { entries } = await loadList("/en/admin/audit-log");

    expect(entries[0]?.date).toContain("11/24/26");
  });

  it("sin actor dice Sistema", async () => {
    serve({ entries: [buildEntry({ actor: null })] });

    expect(await renderList()).toContain("Sistema");
  });

  it("a un actor sin nombre lo muestra con su correo", async () => {
    serve({
      entries: [
        buildEntry({ actor: { full_name: "  ", email: UNNAMED.email } }),
      ],
    });

    const { entries } = await loadList();

    expect(entries[0]?.actorName).toBe(UNNAMED.email);
  });

  it("cada entrada abre su detalle y conserva filtros y página", async () => {
    serve({ entries: [buildEntry()], total: 120 });

    const { entries } = await loadList(
      "/admin/bitacora?accion=faq.publish&pagina=2",
    );

    expect(entries[0]?.href).toBe(
      `/admin/bitacora/${ENTRY_ID}?accion=faq.publish&pagina=2`,
    );
  });

  it("vacía lo dice y ofrece quitar los filtros", async () => {
    serve({ entries: [] });

    const html = await renderList();

    expect(html).toContain("No hay entradas");
    expect(html).toMatch(/href="\/admin\/bitacora"[^>]*>Quitar filtros</);
  });

  it("falla, y no pinta una lista vacía, si la base no responde", async () => {
    serve({ isFailing: true });

    await expect(loadList()).rejects.toThrow(/bitácora/);
  });
});

describe("bitácora: filtros", () => {
  it("filtra por persona, también al contar", async () => {
    const api = serve({ entries: [buildEntry()] });

    await loadList(`/admin/bitacora?persona=${ANDRES.id}`);

    expect(listRequests(api)).toHaveLength(2);
    for (const { url } of listRequests(api)) {
      expect(url.searchParams.get("actor_id")).toBe(`eq.${ANDRES.id}`);
    }
  });

  it("filtra por acción", async () => {
    const api = serve({ entries: [buildEntry()] });

    await loadList("/admin/bitacora?accion=faq.publish");

    expect(rowQuery(api).get("action")).toBe("eq.faq.publish");
  });

  it("filtra por días enteros en la hora de Colombia", async () => {
    const api = serve({ entries: [buildEntry()] });

    await loadList("/admin/bitacora?desde=2026-11-01&hasta=2026-11-24");

    expect(rowQuery(api).getAll("created_at")).toEqual([
      "gte.2026-11-01T00:00:00-05:00",
      "lte.2026-11-24T23:59:59.999999-05:00",
    ]);
  });

  it("un rango de un solo día es válido", async () => {
    serve({ entries: [buildEntry()] });

    const view = await loadList(
      "/admin/bitacora?desde=2026-11-24&hasta=2026-11-24",
    );

    expect(view.state).toBe("entries");
  });

  it("combina los filtros y los conserva en el formulario y la paginación", async () => {
    const search = `persona=${ANDRES.id}&accion=faq.publish&desde=2026-11-01&hasta=2026-11-24`;
    const api = serve({ entries: [buildEntry()], total: 51 });

    const view = await loadList(`/admin/bitacora?${search}`);

    expect(rowQuery(api).get("actor_id")).toBe(`eq.${ANDRES.id}`);
    expect(rowQuery(api).get("action")).toBe("eq.faq.publish");
    expect(rowQuery(api).getAll("created_at")).toHaveLength(2);
    expect(view.filters).toEqual({
      actorId: ANDRES.id,
      action: "faq.publish",
      fromDay: "2026-11-01",
      toDay: "2026-11-24",
    });
    expect(view.pagination.nextHref).toBe(`/admin/bitacora?${search}&pagina=2`);
  });

  it("pinta un formulario GET con lo elegido, que sirve sin JavaScript", async () => {
    serve({ entries: [buildEntry()] });

    const html = await renderList(
      `/admin/bitacora?persona=${ANDRES.id}&desde=2026-11-01`,
    );

    expect(html).toMatch(/<form[^>]*method="get"/);
    for (const name of ["persona", "accion", "desde", "hasta"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain(`<option value="${ANDRES.id}" selected="">`);
    expect(html).toMatch(/type="date"[^>]*value="2026-11-01"/);
    expect(html).toMatch(/<button[^>]*type="submit"/);
  });

  it("ofrece las personas por nombre, o por correo si no tienen", async () => {
    serve({ entries: [] });

    const { options } = await loadList();

    expect(options.actors).toEqual([
      { id: ANDRES.id, name: ANDRES.full_name },
      { id: UNNAMED.id, name: UNNAMED.email },
    ]);
  });

  it("a dos personas con el mismo nombre las distingue el correo", async () => {
    const twin = {
      ...ANDRES,
      id: "0f0f0f0f-5555-4666-8777-988889999000",
      email: "otro@prueba.volleytip.test",
    };
    serve({ actors: [ANDRES, twin, UNNAMED], entries: [] });

    const { options } = await loadList();

    expect(options.actors.map(({ name }) => name)).toEqual([
      `Andrés Gómez (${ANDRES.email})`,
      `Andrés Gómez (${twin.email})`,
      UNNAMED.email,
    ]);
  });

  it.each([
    "persona=no-es-un-id",
    "persona=00000000-0000-4000-8000-000000000000",
    "accion=no.existe",
    "desde=ayer",
    "desde=2026-13-01",
    "hasta=2026-02-30",
    "hasta=0000-01-01",
    "desde=24%2F11%2F2026",
  ])("ignora un valor inválido (%s)", async (search) => {
    const api = serve({ entries: [buildEntry()] });

    const view = await loadList(`/admin/bitacora?${search}`);

    const query = rowQuery(api);
    expect(query.has("actor_id")).toBe(false);
    expect(query.has("action")).toBe(false);
    expect(query.has("created_at")).toBe(false);
    expect(view.entries).toHaveLength(1);
  });

  it("un valor inválido no anula los demás filtros", async () => {
    const api = serve({ entries: [buildEntry()] });

    await loadList("/admin/bitacora?desde=ayer&accion=faq.publish");

    expect(rowQuery(api).get("action")).toBe("eq.faq.publish");
    expect(rowQuery(api).has("created_at")).toBe(false);
  });

  it("con el rango invertido lo dice y no consulta ni lista nada", async () => {
    const api = serve({ entries: [buildEntry()] });
    const path = "/admin/bitacora?desde=2026-11-24&hasta=2026-11-01";

    const view = await loadList(path);

    expect(view.state).toBe("inverted");
    expect(view.entries).toEqual([]);
    expect(listRequests(api)).toEqual([]);
    const html = await renderList(path);
    expect(html).toContain("La fecha final es anterior a la inicial");
    expect(html).toContain("Quitar filtros");
  });

  it("un filtro sin resultados lo dice y ofrece quitarlo", async () => {
    serve({ entries: [] });

    const html = await renderList("/admin/bitacora?accion=faq.publish");

    expect(html).toContain("No hay entradas");
    expect(html).toContain("Quitar filtros");
  });
});

describe("bitácora: detalle", () => {
  it("muestra el antes y el después campo por campo", async () => {
    serve({
      entries: [
        buildEntry({
          details: {
            before: { status: "draft", position: 2 },
            after: { status: "published", position: 1 },
          },
        }),
      ],
    });

    const { changes, extras } = await loadEntry();

    expect(changes).toEqual([
      {
        field: "status",
        before: { kind: "text", text: "draft" },
        after: { kind: "text", text: "published" },
      },
      {
        field: "position",
        before: { kind: "text", text: "2" },
        after: { kind: "text", text: "1" },
      },
    ]);
    expect(extras).toEqual([]);
  });

  it("en una creación el antes no tiene valor", async () => {
    serve({
      entries: [buildEntry({ details: { before: null, after: { name: "" } } })],
    });

    const { changes } = await loadEntry();

    expect(changes).toEqual([
      { field: "name", before: { kind: "absent" }, after: { kind: "empty" } },
    ]);
  });

  it("pinta como JSON los valores compuestos y los nulos", async () => {
    serve({
      entries: [
        buildEntry({
          details: { before: { value: null }, after: { value: { a: [1] } } },
        }),
      ],
    });

    const { changes } = await loadEntry();

    expect(changes[0]?.before).toEqual({ kind: "text", text: "null" });
    expect(changes[0]?.after).toEqual({
      kind: "text",
      text: JSON.stringify({ a: [1] }, null, 2),
    });
  });

  it("muestra los demás datos de la entrada, como la clave", async () => {
    serve({
      entries: [
        buildEntry({
          entity_id: null,
          details: { key: "home.title:es", before: {}, after: {} },
        }),
      ],
    });

    const { extras } = await loadEntry();

    expect(extras).toEqual([
      { field: "key", value: { kind: "text", text: "home.title:es" } },
    ]);
  });

  it("una entrada sin antes ni después muestra sus datos", async () => {
    const html = await renderEntry({ createdAccount: true });

    expect(html).toContain("createdAccount");
    expect(html).toContain("true");
  });

  it("una entrada sin datos lo dice", async () => {
    expect(await renderEntry({})).toContain("no guardó datos");
  });

  it("pinta el HTML como texto", async () => {
    const html = await renderEntry({
      before: { body: "<b>antes</b>" },
      after: { body: '<img src=x onerror="alert(1)">' },
    });

    expect(html).toContain("&lt;b&gt;antes&lt;/b&gt;");
    expect(html).toContain("&lt;img src=x onerror=");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>antes");
  });

  it("dice quién, cuándo, qué acción y sobre qué", async () => {
    const html = await renderEntry({});

    expect(html).toContain("Andrés Gómez");
    expect(html).toContain("faq.publish");
    expect(html).toContain("24/11/26");
    expect(html).toContain("5a6b7c8d-3333-4444-8555-966677778888");
  });

  it("sin actor dice Sistema", async () => {
    serve({ entries: [buildEntry({ actor: null })] });

    const view = await loadEntry();

    expect(render(<entryRoute.AuditEntryPage {...view} />)).toContain(
      "Sistema",
    );
  });

  it("volver conserva los filtros y la página", async () => {
    serve({ entries: [buildEntry()] });

    const { backHref } = await loadEntry(
      `/admin/bitacora/${ENTRY_ID}?accion=faq.publish&pagina=2`,
    );

    expect(backHref).toBe("/admin/bitacora?accion=faq.publish&pagina=2");
  });

  it("volver deja fuera lo que no es de la lista", async () => {
    serve({ entries: [buildEntry()] });

    const { backHref } = await loadEntry(
      `/admin/bitacora/${ENTRY_ID}?_routes=algo&pagina=2`,
    );

    expect(backHref).toBe("/admin/bitacora?pagina=2");
  });

  it.each(["no-es-un-id", "00000000-0000-4000-8000-000000000000"])(
    "una entrada que no existe (%s) responde 404",
    async (id) => {
      serve({ entries: [buildEntry()] });

      await expect(
        loadEntry(`/admin/bitacora/${id}`, id),
      ).rejects.toMatchObject({ init: { status: 404 } });
    },
  );
});

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((path) => join(directory, path))
    .filter(
      (path) =>
        /\.tsx?$/.test(path) &&
        !/\.test\.tsx?$/.test(path) &&
        !path.includes("testing"),
    );
}

describe("bitácora: solo lectura", () => {
  it.each([
    ["la lista", listRoute],
    ["el detalle", entryRoute],
  ])("el archivo de %s no exporta action", (_name, module) => {
    expect(Object.keys(module)).not.toContain("action");
  });

  it("ningún código del servidor edita ni borra la bitácora", () => {
    const offenders = ["src", "scripts"]
      .flatMap(listSourceFiles)
      .filter((path) =>
        /from\(\s*["']audit_log["']\s*\)\s*\.(update|delete|upsert)\b/.test(
          readFileSync(path, "utf8"),
        ),
      );

    expect(offenders).toEqual([]);
  });

  it("la pantalla no ofrece más formulario que el de los filtros", async () => {
    serve({ entries: [buildEntry()] });

    const html = await renderList();

    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).not.toMatch(/method="post"/);
  });
});

function findParents(
  entries: readonly RouteConfigEntry[],
  file: string,
  parents: readonly string[] = [],
): string[][] {
  return entries.flatMap((entry) =>
    entry.file === file
      ? [[...parents]]
      : findParents(entry.children ?? [], file, [...parents, entry.file]),
  );
}

describe("bitácora: permisos", () => {
  it.each(["routes/panel/audit-log.tsx", "routes/panel/audit-log-entry.tsx"])(
    "%s queda detrás de la guardia de admin en los dos idiomas",
    (file) => {
      const parents = findParents(routes, file);

      expect(parents).toHaveLength(2);
      for (const chain of parents) {
        expect(chain).toContain("routes/panel/admin-layout.tsx");
      }
      expect(adminLayout.middleware).toContain(requireAdmin);
    },
  );

  async function passGuards(role: "buyer" | "staff"): Promise<void> {
    stubSupabase({
      profile: {
        role,
        is_active: true,
        full_name: null,
        email: "persona@prueba.volleytip.test",
      },
    });
    const args =
      buildArgs<Parameters<typeof requireAdmin>[0]>("/admin/bitacora");
    const next = async (): Promise<Response> => new Response();
    await requirePanelMember(args, next);
    await requireAdmin(args, next);
  }

  it("un comprador no lee la bitácora: recibe 404", async () => {
    await expect(passGuards("buyer")).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("el staff no lee la bitácora: vuelve a su única pantalla", async () => {
    await expect(passGuards("staff")).rejects.toMatchObject({ status: 302 });
  });
});

describe("bitácora: módulo", () => {
  it.each([
    ["es", "/admin/bitacora"],
    ["en", "/en/admin/audit-log"],
  ] as const)("aparece en el menú lateral y en Más (%s)", (language, href) => {
    const { sidebar, more } = buildPanelNavigation(ADMIN_MODULES, {
      role: "admin",
      language,
      pathname: `${href}/${ENTRY_ID}`,
      pendingCounts: {},
      morePath: getPanelPath("adminMore", language),
    });

    expect(sidebar.at(-1)).toMatchObject({ href, isCurrent: true });
    expect(more.map((entry) => entry.href)).toContain(href);
  });
});
