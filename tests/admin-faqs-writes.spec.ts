/**
 * Crear, traducir, publicar, ordenar y retirar preguntas desde el panel y
 * verlas en el sitio (FR-137, AC-065, #127), con y sin JavaScript.
 *
 * Publican preguntas en la página real, que las demás pruebas esperan vacía:
 * por eso tienen su propio proyecto en `playwright.config.ts`, que corre
 * cuando las otras ya terminaron. Para correr solo estas:
 * `npx playwright test --project=preguntas-que-escriben --no-deps`.
 */
import type { Locator, Page } from "@playwright/test";

import { removeAllFaqs } from "./support/faq-rows";
import { readLocalSupabaseStatusOnce } from "./support/local-supabase-status-once";
import { expect, test } from "./support/panel-session";

const FIRST = "¿Hacen envíos fuera de Colombia?";
const SECOND = "¿Cómo me inscribo a un camp?";
const FIRST_ENGLISH = "Do you ship outside Colombia?";
const HTML_ANSWER = "<b>Solo</b> dentro de Colombia.";
const BAD_REQUEST_STATUS = 400;

test.beforeEach(async () => {
  await removeAllFaqs(readLocalSupabaseStatusOnce());
});

test.afterEach(async () => {
  await removeAllFaqs(readLocalSupabaseStatusOnce());
});

/** Activa un control solo con el teclado. */
async function pressOn(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press("Enter");
}

async function submitAndReadStatus(
  page: Page,
  button: Locator,
): Promise<number> {
  const answer = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await pressOn(button);
  return (await answer).status();
}

/** Las preguntas de la página pública, en su orden. */
async function expectPublicQuestions(
  page: Page,
  path: "/preguntas-frecuentes" | "/en/faq",
  questions: readonly string[],
): Promise<void> {
  await page.goto(path);
  await expect(page.locator("summary")).toHaveText([...questions]);
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`preguntas ${javaScriptEnabled ? "con" : "sin"} JavaScript`, () => {
    test.use({ javaScriptEnabled });

    // Sin hidratar, un envío saldría como el del navegador sin JavaScript.
    async function open(page: Page, path = "/admin/preguntas"): Promise<void> {
      await page.goto(path);
      if (javaScriptEnabled) await page.waitForLoadState("networkidle");
    }

    async function fillLanguage(
      page: Page,
      name: "Español" | "English",
      question: string,
      answer: string,
    ): Promise<void> {
      if (javaScriptEnabled) {
        await page.getByRole("tab", { name: new RegExp(name) }).click();
      }
      await page.getByLabel(`Pregunta (${name})`).fill(question);
      await page.getByLabel(`Respuesta (${name})`).fill(answer);
    }

    async function createDraft(page: Page, question: string): Promise<void> {
      await open(page, "/admin/preguntas/nueva");
      await fillLanguage(page, "Español", question, HTML_ANSWER);
      await pressOn(page.getByRole("button", { name: "Crear borrador" }));
      await expect(
        page.getByText("Pregunta creada como borrador."),
      ).toBeVisible();
    }

    // Se espera la insignia de la fila: el aviso del envío anterior dice lo
    // mismo y seguiría a la vista.
    async function publish(page: Page, position: number): Promise<void> {
      await pressOn(
        page.getByRole("button", { name: `Publicar la pregunta ${position}` }),
      );
      await expect(
        page.getByRole("button", { name: `Retirar la pregunta ${position}` }),
      ).toBeVisible();
      await expect(page.getByText("Pregunta publicada.")).toBeVisible();
    }

    test.beforeEach(async ({ signInToPanel }) => {
      await signInToPanel({ role: "admin" });
    });

    test("crea, publica y traduce una pregunta, y el sitio la muestra", async ({
      page,
    }) => {
      await open(page);
      await page
        .getByRole("link", { name: "Crear la primera pregunta" })
        .click();
      await expect(page).toHaveURL("/admin/preguntas/nueva");
      if (javaScriptEnabled) await page.waitForLoadState("networkidle");
      await fillLanguage(page, "Español", FIRST, HTML_ANSWER);
      await pressOn(page.getByRole("button", { name: "Crear borrador" }));
      await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
      await expectPublicQuestions(page, "/preguntas-frecuentes", []);

      await open(page);
      await publish(page, 1);

      await expect(
        page.getByText("Falta inglés: en /en/ saldrá en español."),
      ).toBeVisible();
      await expectPublicQuestions(page, "/preguntas-frecuentes", [FIRST]);
      await page.locator("summary").click();
      await expect(page.getByText(HTML_ANSWER, { exact: true })).toBeVisible();
      await expectPublicQuestions(page, "/en/faq", [FIRST]);

      await open(page);
      await page.getByRole("link", { name: "Editar la pregunta 1" }).click();
      await expect(page.getByLabel("Pregunta (Español)")).toHaveValue(FIRST);
      if (javaScriptEnabled) await page.waitForLoadState("networkidle");
      await fillLanguage(page, "English", FIRST_ENGLISH, "Only in Colombia.");
      await pressOn(page.getByRole("button", { name: "Guardar pregunta" }));
      await expect(page.getByText("Cambios guardados.")).toBeVisible();

      await expectPublicQuestions(page, "/en/faq", [FIRST_ENGLISH]);
    });

    test("reordena con el teclado, retira y vuelve a publicar", async ({
      page,
    }) => {
      await createDraft(page, FIRST);
      await createDraft(page, SECOND);
      await open(page);
      await publish(page, 1);
      await publish(page, 2);
      await expect(
        page.getByRole("button", { name: "Subir la pregunta 1" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Bajar la pregunta 2" }),
      ).toBeDisabled();

      await pressOn(page.getByRole("button", { name: "Subir la pregunta 2" }));

      await expect(
        page.getByText("La pregunta quedó en la posición 1."),
      ).toBeVisible();
      if (javaScriptEnabled) {
        // En el primer lugar "Subir" se apaga: el foco pasa a "Bajar".
        await expect(
          page.getByRole("button", { name: "Bajar la pregunta 1" }),
        ).toBeFocused();
      }
      await expectPublicQuestions(page, "/preguntas-frecuentes", [
        SECOND,
        FIRST,
      ]);

      await open(page);
      await pressOn(
        page.getByRole("button", { name: "Retirar la pregunta 1" }),
      );
      await expect(page.getByText("Pregunta retirada.")).toBeVisible();
      await expect(page.getByText("Retirada", { exact: true })).toBeVisible();
      await expectPublicQuestions(page, "/preguntas-frecuentes", [FIRST]);

      await open(page);
      await publish(page, 1);
      await expectPublicQuestions(page, "/preguntas-frecuentes", [
        SECOND,
        FIRST,
      ]);
    });

    test("muestra por qué no se publica sin español", async ({ page }) => {
      await open(page, "/admin/preguntas/nueva");
      await fillLanguage(page, "English", FIRST_ENGLISH, "Only in Colombia.");
      await pressOn(page.getByRole("button", { name: "Crear borrador" }));
      await expect(
        page.getByText("Pregunta creada como borrador."),
      ).toBeVisible();

      const status = await submitAndReadStatus(
        page,
        page.getByRole("button", { name: "Publicar la pregunta 1" }),
      );

      expect(status).toBe(BAD_REQUEST_STATUS);
      await expect(page.getByRole("alert")).toContainText(
        "No se publicó: escribe la pregunta y la respuesta en español.",
      );
      await expectPublicQuestions(page, "/preguntas-frecuentes", []);
    });

    test("un texto largo responde 400, lo marca y lo conserva", async ({
      page,
    }) => {
      const long = "x".repeat(201);
      await open(page, "/admin/preguntas/nueva");
      await fillLanguage(page, "Español", long, "Respuesta");

      const status = await submitAndReadStatus(
        page,
        page.getByRole("button", { name: "Crear borrador" }),
      );

      expect(status).toBe(BAD_REQUEST_STATUS);
      const field = page.getByLabel("Pregunta (Español)");
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveValue(long);
      await expect(page.getByLabel("Respuesta (Español)")).toHaveValue(
        "Respuesta",
      );
    });
  });
}
