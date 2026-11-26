/**
 * Publicar la barra desde el panel y verla en el sitio (AC-021, #126).
 *
 * Cambia la barra que todas las demás pruebas capturan: por eso las specs
 * `*.writes.spec.ts` corren en su propio proyecto, cuando las otras ya
 * terminaron (`playwright.config.ts`). Para correr solo esta:
 * `npx playwright test admin-site-texts.writes --no-deps`.
 */
import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { expect, test } from "./support/panel-session";
import {
  ANNOUNCEMENT_FIXTURES,
  seedSettingsFixtures,
} from "./support/site-fixtures";

const NEW_SECOND = {
  es: "Nuevo segundo aviso",
  en: "Brand new second notice",
} as const;

test.afterEach(async () => {
  await seedSettingsFixtures(readLocalSupabaseStatusOnce());
});

// La barra la pinta la cáscara de todas las páginas: se miran varias.
const PUBLIC_PAGES = [
  { language: "es", paths: ["/", "/nosotros", "/contacto"] },
  { language: "en", paths: ["/en/", "/en/about", "/en/contact"] },
] as const;

test("cambiar el segundo mensaje se ve en las páginas públicas en los dos idiomas", async ({
  page,
  signInToPanel,
}) => {
  await signInToPanel({ role: "admin" });
  await page.goto("/admin/textos");
  await page.waitForLoadState("networkidle");
  const second = page.getByRole("group", { name: "Mensaje 2" });
  await second.getByLabel("Texto en español").fill(NEW_SECOND.es);
  await second.getByLabel("Texto en inglés").fill(NEW_SECOND.en);

  await page.getByRole("button", { name: "Guardar barra" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Cambios guardados." }),
  ).toBeVisible();
  for (const { language, paths } of PUBLIC_PAGES) {
    for (const path of paths) {
      await page.goto(path);
      await expect(
        page.getByText(NEW_SECOND[language], { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(ANNOUNCEMENT_FIXTURES[1][language], { exact: true }),
      ).toHaveCount(0);
    }
  }
});
