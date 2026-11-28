/**
 * "Equipo" del panel (#130): accesibilidad, desborde y zonas de toque de cada
 * estado en los cuatro anchos y los dos idiomas, y contra la base local,
 * invitar a un staff, cambiarle el rol, desactivarlo y activarlo, con y sin
 * JavaScript. Las capturas viven en ui.spec.ts.
 */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { deleteTestAccount } from "../src/testing/local-session";
import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { expect, test } from "./support/panel-session";

const MIN_TOUCH_TARGET = 44;
const SIDEBAR_FROM_WIDTH = 768;
/** Holgura para lo que todavía crezca después de medir la página. */
const SPARE_HEIGHT = 200;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const STATES = [
  "lista",
  "invitada",
  "rechazo",
  "invitar",
  "errores",
  "ya-esta",
  "confirmar",
  "ultimo-admin",
] as const;

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  // Con la ventana tan alta como la página, la barra inferior fija no tapa a
  // medias ningún control: axe lo contaría como una zona de toque pequeña.
  const width = page.viewportSize()?.width ?? 0;
  await page.emulateMedia({ reducedMotion: "reduce" });
  const height = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.documentElement.scrollHeight;
  });
  await page.setViewportSize({ width, height: height + SPARE_HEIGHT });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

async function expectTouchTargets(page: Page): Promise<void> {
  const boxes = await page
    .getByRole("main")
    .locator("button, a[href], input:not([type=hidden]), select")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.checkVisibility())
        .map((element) => ({
          text: element.textContent,
          height: element.getBoundingClientRect().height,
        })),
    );
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.height, box.text ?? "").toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }
}

for (const viewport of VIEWPORTS) {
  test.describe(`equipo @ ${viewport.width}`, () => {
    test.use({ viewport });

    for (const state of STATES) {
      for (const path of ["/dev/equipo", "/en/dev/equipo"]) {
        test(`${path} en estado ${state} es accesible`, async ({ page }) => {
          await page.goto(`${path}?estado=${state}`);
          await page.waitForLoadState("networkidle");

          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectTouchTargets(page);
          await expectAccessibleWithoutOverflow(page);
        });
      }
    }

    test("un admin llega a la pantalla desde el menú", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      const hasSidebar = viewport.width >= SIDEBAR_FROM_WIDTH;
      await page.goto(hasSidebar ? "/admin" : "/admin/mas");

      await page
        .getByRole(hasSidebar ? "complementary" : "main")
        .getByRole("link", { name: "Equipo" })
        .click();

      await expect(page).toHaveURL("/admin/equipo");
      await expect(
        page.getByRole("heading", { level: 1, name: "Equipo" }),
      ).toBeVisible();
    });
  });
}

test.describe("equipo sin conexión", () => {
  test("invitar conserva lo escrito y avisa", async ({
    page,
    context,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });
    await page.goto("/admin/equipo/invitar");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Correo").fill("nora@example.com");
    await context.setOffline(true);

    await page.getByRole("button", { name: "Invitar" }).click();

    await expect(page.getByRole("alert")).toContainText("No se pudo enviar");
    await expect(page.getByLabel("Correo")).toHaveValue("nora@example.com");
    await expect(page).toHaveURL("/admin/equipo/invitar");
  });

  test("un botón de la lista deja a la persona donde estaba", async ({
    page,
    context,
    signInToPanel,
  }) => {
    // Dos filas ajenas a quien mira: la propia no tiene botones.
    await signInToPanel({ role: "admin", fullName: "Otra Admin" });
    await signInToPanel({ role: "admin" });
    await page.goto("/admin/equipo");
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);

    await page
      .getByRole("button", { name: "Pasar a staff a Otra Admin" })
      .first()
      .click();

    await expect(page.getByRole("alert")).toContainText("No se pudo enviar");
    await expect(page).toHaveURL("/admin/equipo");
  });
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(`equipo ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });
    let email: string;

    test.beforeEach(() => {
      email = `equipo-${randomUUID()}@example.com`;
    });

    test.afterEach(async () => {
      await deleteTestAccount(readLocalSupabaseStatusOnce(), email);
    });

    // Sin hidratar, un envío saldría como el del navegador sin JavaScript.
    async function waitForPage(page: Page): Promise<void> {
      if (javaScriptEnabled) await page.waitForLoadState("networkidle");
    }

    test("invitar a un staff, administrarlo y verlo en la lista", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await page.goto("/admin/equipo/invitar");
      await waitForPage(page);

      await page.getByLabel("Nombre").fill("Persona Invitada");
      await page.getByLabel("Correo").fill(`  ${email.toUpperCase()} `);
      await page.getByLabel("Rol").selectOption("staff");
      await page.getByRole("button", { name: "Invitar" }).click();

      await expect(page).toHaveURL("/admin/equipo?aviso=invited");
      await expect(
        page.getByRole("status").filter({ hasText: "Invitación lista" }),
      ).toContainText("No se envió ningún correo");
      const row = page.locator("li[data-member-row]", { hasText: email });
      await expect(row).toContainText("Persona Invitada");
      await expect(row).toContainText("Staff");
      await expect(row).toContainText("Aún no ha entrado");

      await waitForPage(page);
      await row
        .getByRole("button", { name: "Hacer admin a Persona Invitada" })
        .click();
      await expect(row.locator("[data-member-role]")).toHaveText("Admin");

      await waitForPage(page);
      await row
        .getByRole("link", { name: "Desactivar a Persona Invitada" })
        .click();
      await expect(
        page.getByText(`¿Desactivar a Persona Invitada (${email})?`),
      ).toBeVisible();
      await waitForPage(page);
      await page.getByRole("button", { name: "Sí, desactivar" }).click();

      await expect(page).toHaveURL("/admin/equipo?aviso=deactivated");
      await expect(row).toContainText("Desactivado");

      await waitForPage(page);
      const activate = row.getByRole("button", {
        name: "Activar a Persona Invitada",
      });
      await activate.focus();
      await activate.press("Enter");

      await expect(row.locator("[data-member-active]")).toHaveText("Activo");
      if (javaScriptEnabled) {
        // El botón desapareció: el foco se queda en su fila.
        await expect(row.locator(":focus")).toHaveCount(1);
      }
    });

    test("un envío inválido marca los campos", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin" });
      await page.goto("/admin/equipo/invitar");
      await waitForPage(page);

      await page.getByLabel("Correo").fill("nora@");
      const answer = page.waitForResponse(
        (response) => response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Invitar" }).click();

      expect((await answer).status()).toBe(400);
      await expect(page.getByLabel("Nombre")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByLabel("Correo")).toHaveValue("nora@");
      if (javaScriptEnabled) {
        await expect(page.getByLabel("Nombre")).toBeFocused();
      }
    });
  });
}
