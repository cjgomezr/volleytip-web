/**
 * Acceso al panel (#119): sesión en cookies, guardia por rol, pantallas
 * provisionales y cierre de sesión, contra la base local. Las capturas de
 * estas pantallas viven en `ui.spec.ts`.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./support/panel-session";

const NOT_FOUND_STATUS = 404;
const FULL_NAME = "Andrés Gómez";
const MIN_TOUCH_TARGET = 44;
const SIDEBAR_FROM_WIDTH = 768;
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

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

for (const viewport of VIEWPORTS) {
  test.describe(`panel @ ${viewport.width}`, () => {
    test.use({ viewport });

    test("sin sesión termina en la pantalla de entrada", async ({ page }) => {
      await page.goto("/admin");

      await expect(page).toHaveURL("/admin/entrar?next=%2Fadmin");
      await expect(
        page.getByRole("heading", { level: 1, name: "Entrar al panel" }),
      ).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });

    test("un admin ve su nombre y el botón para salir", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "admin", fullName: FULL_NAME });

      const response = await page.goto("/admin");

      expect(response?.status()).toBe(200);
      const hasSidebar = viewport.width >= SIDEBAR_FROM_WIDTH;
      const person = page.getByRole(hasSidebar ? "complementary" : "banner");
      await expect(person.getByText(FULL_NAME)).toBeVisible();
      // En celular "Cerrar sesión" está en "Más".
      if (!hasSidebar) await page.goto("/admin/mas");
      const button = page
        .getByRole(hasSidebar ? "complementary" : "main")
        .getByRole("button", { name: "Cerrar sesión" });
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      await expectAccessibleWithoutOverflow(page);
    });

    test("un staff ve solo la explicación de su acceso", async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "staff", fullName: FULL_NAME });

      await page.goto("/admin/mensajes");

      await expect(page).toHaveURL("/admin");
      await expect(page.getByText(/escáner de entradas/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cerrar sesión" }),
      ).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });
  });
}

test.describe("panel en inglés y casos de acceso", () => {
  test("un admin sin nombre ve su correo en /en/admin", async ({
    page,
    signInToPanel,
  }) => {
    const { email } = await signInToPanel({ role: "admin" });

    await page.goto("/en/admin");

    await expect(
      page.getByRole("complementary").getByText(email),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expectAccessibleWithoutOverflow(page);
  });

  for (const { path, signIn, destination } of [
    {
      path: "/admin",
      signIn: "/admin/entrar",
      destination: "/admin/entrar?next=%2Fadmin",
    },
    {
      path: "/en/admin/messages?page=2",
      signIn: "/en/admin/sign-in",
      destination: "/en/admin/sign-in?next=%2Fen%2Fadmin%2Fmessages%3Fpage%3D2",
    },
  ]) {
    test(`sin sesión, ${path} va a ${signIn} y recuerda la dirección`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page).toHaveURL(destination);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
    });
  }

  test("con sesión, la entrada ignora un regreso a otro sitio", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });

    await page.goto("/admin/entrar?next=%2F%2Fsitio-ajeno.test");

    await expect(page).toHaveURL("/admin");
  });

  for (const path of ["/admin", "/admin/no-existe", "/en/admin"]) {
    test(`un buyer recibe en ${path} la página 404 de siempre`, async ({
      page,
      signInToPanel,
    }) => {
      await signInToPanel({ role: "buyer" });

      const response = await page.goto(path);

      expect(response?.status()).toBe(NOT_FOUND_STATUS);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        path.startsWith("/en") ? "Out of bounds" : "Balón fuera",
      );
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expectAccessibleWithoutOverflow(page);
    });
  }

  test("un admin recibe 404 en una dirección del panel que no existe", async ({
    page,
    signInToPanel,
  }) => {
    await signInToPanel({ role: "admin" });

    const response = await page.goto("/admin/no-existe");

    expect(response?.status()).toBe(NOT_FOUND_STATUS);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Balón fuera",
    );
  });

  test("un admin desactivado pierde el acceso en la siguiente petición", async ({
    page,
    signInToPanel,
    deactivate,
  }) => {
    const session = await signInToPanel({ role: "admin" });
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin");

    await deactivate(session);
    await page.reload();

    await expect(page).toHaveURL("/admin/entrar?next=%2Fadmin");
  });
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(`cerrar sesión ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });

    test("borra las cookies y deja en la pantalla de entrada", async ({
      page,
      context,
      signInToPanel,
    }) => {
      const { cookies } = await signInToPanel({ role: "admin" });
      await page.goto("/admin");

      await page
        .getByRole("complementary")
        .getByRole("button", { name: "Cerrar sesión" })
        .click();

      await expect(page).toHaveURL("/admin/entrar");
      const names = (await context.cookies()).map(({ name }) => name);
      for (const { name } of cookies) expect(names).not.toContain(name);
      await page.goto("/admin");
      await expect(page).toHaveURL("/admin/entrar?next=%2Fadmin");
    });
  });
}
