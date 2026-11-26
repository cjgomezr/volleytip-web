/**
 * La bandeja de mensajes (#125). Los estados se prueban en la página de
 * muestra (/dev/mensajes), que no usa la base; filtrar, abrir y cambiar el
 * estado, en el panel real contra la base local. Las capturas viven en
 * `ui.spec.ts`.
 */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { insertMessages, removeMessages } from "./support/message-rows";
import { expect, test as panelTest } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const MISSING_ID = "a1b2c3d4-0000-4000-8000-000000000000";
const HOSTILE_BODY =
  '<img src="x" onerror="window.hacked=true"> Hola\nhttps://sitio-ajeno.test/clic';
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const LANGUAGES = [
  {
    code: "es",
    sample: "/dev/mensajes",
    clear: "Quitar filtros",
    empty: "Todavía no hay mensajes.",
    noResults: "Ningún mensaje coincide con los filtros.",
    filter: "Filtrar",
  },
  {
    code: "en",
    sample: "/en/dev/mensajes",
    clear: "Clear filters",
    empty: "There are no messages yet.",
    noResults: "No message matches the filters.",
    filter: "Filter",
  },
] as const;
const STATES = [
  "lista",
  "vacia",
  "sin-resultados",
  "detalle-pedido",
  "detalle-marcas",
] as const;

interface Inbox {
  /** Distingue los mensajes de esta prueba: se busca por él. */
  readonly domain: string;
  /** El id del mensaje de Laura, el de un pedido. */
  readonly orderId: string;
}

const test = panelTest.extend<{ inbox: Inbox }>({
  // eslint-disable-next-line no-empty-pattern
  inbox: async ({}, use) => {
    const status = readLocalSupabaseStatusOnce();
    const domain = `bandeja-${randomUUID().slice(0, 8)}.test`;
    try {
      const [orderId = ""] = await insertMessages(status, [
        {
          name: "Laura Prueba",
          email: `laura@${domain}`,
          reason: "order",
          body: HOSTILE_BODY,
        },
        {
          name: "Marca Prueba",
          email: `marca@${domain}`,
          reason: "brands",
          body: "Hola",
        },
      ]);
      await use({ domain, orderId });
    } finally {
      await removeMessages(status, domain);
    }
  },
});

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

/** Ningún texto de la bandeja se sale de la caja que lo contiene. */
async function expectNoOverflowingText(page: Page): Promise<void> {
  const overflowing = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main :is(a, button, h1, h2, p, span, time, td, th, dt, dd)",
      ),
    ]
      .filter(
        (element) =>
          element.checkVisibility() &&
          !element.closest(".sr-only, thead") &&
          // El resumen de un mensaje se corta a propósito en dos líneas.
          element.clientWidth > 0 &&
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => element.textContent),
  );
  expect(overflowing).toEqual([]);
}

async function expectTouchHeight(controls: Locator): Promise<void> {
  const all = await controls.all();
  expect(all.length).toBeGreaterThan(0);
  for (const control of all) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

/** Activa un control solo con el teclado. */
async function pressOn(control: Locator, key = "Enter"): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press(key);
}

for (const language of LANGUAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`bandeja ${language.code} @ ${viewport.width}`, () => {
      test.use({ viewport });

      for (const state of STATES) {
        test(`${state}: axe, sin desborde ni texto fuera de su caja`, async ({
          page,
        }) => {
          await page.goto(`${language.sample}?estado=${state}`);

          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectNoOverflowingText(page);
          await expectAccessibleWithoutOverflow(page);
          await expectTouchHeight(
            page.getByRole("main").locator("a, button, input, select"),
          );
        });
      }

      test("vacía y sin resultados lo dicen", async ({ page }) => {
        await page.goto(`${language.sample}?estado=vacia`);
        await expect(page.getByText(language.empty)).toBeVisible();

        await page.goto(`${language.sample}?estado=sin-resultados`);
        await expect(page.getByText(language.noResults)).toBeVisible();
        await expect(
          page.getByRole("link", { name: language.clear }),
        ).toBeVisible();
      });

      test("la lista conserva sus filas y celdas como tabla", async ({
        page,
      }) => {
        await page.goto(`${language.sample}?estado=lista`);

        const table = page.getByRole("table");
        await expect(table.getByRole("row")).toHaveCount(5);
        await expect(table.getByRole("columnheader")).toHaveCount(4);
        await expect(table.getByRole("cell")).toHaveCount(16);
      });
    });
  }
}

test.describe("bandeja en celular", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("tocar cualquier parte de una fila abre el mensaje", async ({
    page,
  }) => {
    await page.goto("/dev/mensajes");

    await page
      .locator("[data-message-row] time")
      .first()
      .click({ force: true });

    await expect(page).toHaveURL("/dev/mensajes?estado=detalle-pedido");
  });

  test("Mensajes ocupa un lugar en la barra inferior con su número", async ({
    page,
    signInToPanel,
    inbox,
  }) => {
    await signInToPanel({ role: "admin" });

    await page.goto(`/admin/mensajes?q=${inbox.domain}`);

    const bar = page.getByRole("navigation", {
      name: "Secciones principales",
    });
    await expect(bar.getByRole("link")).toHaveText([
      /Resumen/,
      /Mensajes/,
      /Más/,
    ]);
    const messages = bar.getByRole("link", { name: /Mensajes/ });
    await expect(messages).toHaveAttribute("aria-current", "page");
    await expect(messages).toHaveAccessibleName(/\d+ pendientes?/);
    await expectNoOverflowingText(page);
    await expectAccessibleWithoutOverflow(page);
  });
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(`bandeja real ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });

    test("filtra con el teclado y conserva los filtros al recargar", async ({
      page,
      signInToPanel,
      inbox,
    }) => {
      await signInToPanel({ role: "admin" });
      await page.goto("/admin/mensajes");
      const search = page.getByLabel("Buscar por nombre o correo");
      const reason = page.getByLabel("Motivo");
      const status = page.getByLabel("Estado");
      // Sin hidratar, el envío es del navegador; con JavaScript, esperar.
      await page.waitForLoadState("networkidle");

      await search.focus();
      await page.keyboard.type(inbox.domain);
      await reason.focus();
      await page.keyboard.press("ArrowDown");
      await status.focus();
      await page.keyboard.press("ArrowDown");
      await pressOn(page.getByRole("button", { name: "Filtrar" }));

      await expect(page).toHaveURL(
        `/admin/mensajes?q=${inbox.domain}&motivo=order&estado=new`,
      );
      const rows = page.locator("[data-message-row]");
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText("Laura Prueba");

      await page.reload();

      await expect(search).toHaveValue(inbox.domain);
      await expect(reason).toHaveValue("order");
      await expect(status).toHaveValue("new");
      await expect(rows).toHaveCount(1);

      await page.waitForLoadState("networkidle");
      await pressOn(page.getByRole("link", { name: "Quitar filtros" }));

      await expect(page).toHaveURL("/admin/mensajes");
      await expect(search).toHaveValue("");
      await expect(reason).toHaveValue("");
      await expect(status).toHaveValue("");
    });

    test("abre un mensaje, lo responde, lo archiva y lo reabre con el teclado", async ({
      page,
      signInToPanel,
      inbox,
    }) => {
      await signInToPanel({ role: "admin", fullName: "Andrés Gómez" });
      await page.goto(`/admin/mensajes?q=${inbox.domain}`);
      await page.waitForLoadState("networkidle");
      const state = page.locator("main [data-message-status]");
      const action = (name: string): Locator =>
        page.getByRole("button", { name, exact: true });

      await pressOn(page.getByRole("link", { name: "Laura Prueba" }));

      await expect(page).toHaveURL(`/admin/mensajes/${inbox.orderId}`);
      await expect(state).toHaveText("Nuevo");
      await expect(
        page.getByRole("link", { name: "Responder por correo" }),
      ).toHaveAttribute("href", new RegExp(`^mailto:laura@${inbox.domain}`));
      await expect(
        page.getByRole("link", { name: "Escribir por WhatsApp" }),
      ).toHaveCount(0);

      await pressOn(action("Marcar respondido"));

      await expect(page).toHaveURL(
        `/admin/mensajes/${inbox.orderId}?saved=answered`,
      );
      await expect(state).toHaveText("Respondido");
      await expect(page.getByText("Respondido por Andrés Gómez")).toBeVisible();

      await pressOn(action("Archivar"));
      await expect(state).toHaveText("Archivado");

      await pressOn(action("Reabrir"));
      await expect(state).toHaveText("Respondido");
    });
  });
}

test.describe("bandeja real", () => {
  test("el HTML y los enlaces del cuerpo se ven como texto", async ({
    page,
    signInToPanel,
    inbox,
  }) => {
    await signInToPanel({ role: "admin" });

    await page.goto(`/admin/mensajes/${inbox.orderId}`);
    await page.waitForLoadState("networkidle");

    const body = page.locator("[data-message-body]");
    expect(await body.innerText()).toBe(HOSTILE_BODY);
    await expect(body.locator("*")).toHaveCount(0);
    expect(await page.evaluate(() => "hacked" in window)).toBe(false);
  });

  for (const id of [MISSING_ID, "no-es-un-id"]) {
    test(`el id inexistente ${id} responde 404 dentro de la cáscara`, async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });

      const response = await page.goto(`/admin/mensajes/${id}`);

      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Ese mensaje no existe",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Secciones", exact: true }),
      ).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });
  }

  test("un comprador recibe el 404 del sitio, sin nada del panel", async ({
    page,
    signInToPanel,
    inbox,
  }) => {
    await signInToPanel({ role: "buyer" });

    for (const path of [
      "/admin/mensajes",
      `/admin/mensajes/${inbox.orderId}`,
    ]) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Laura Prueba")).toHaveCount(0);
      await expect(page.getByRole("complementary")).toHaveCount(0);
      await expect(page.getByText("Ese mensaje no existe")).toHaveCount(0);
    }
  });

  test("un staff vuelve al inicio del panel", async ({
    page,
    signInToPanel,
    inbox,
  }) => {
    await signInToPanel({ role: "staff" });

    await page.goto(`/admin/mensajes/${inbox.orderId}`);

    await expect(page).toHaveURL("/admin");
    await expect(page.getByText("Laura Prueba")).toHaveCount(0);
  });

  test("la tarjeta del resumen abre la bandeja filtrada por nuevos", async ({
    page,
    signInToPanel,
    inbox,
  }) => {
    await signInToPanel({ role: "admin" });
    await page.goto("/admin");

    await page
      .getByRole("main")
      .getByRole("link", { name: /Mensajes sin responder/ })
      .click();

    await expect(page).toHaveURL("/admin/mensajes?estado=new");
    await expect(page.getByLabel("Estado")).toHaveValue("new");
    await expect(
      page.getByRole("link", { name: "Laura Prueba" }).first(),
    ).toBeVisible();
    expect(inbox.orderId).not.toBe("");
  });
});
