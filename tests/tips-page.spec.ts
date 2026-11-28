/**
 * Listado de tips (#158) con tips sembrados en la base local: axe y desborde de
 * cada estado en los cuatro anchos y los dos idiomas, los filtros, la
 * búsqueda, el cambio de idioma y "Cargar más tips" con y sin JavaScript. Las
 * capturas están en `ui.spec.ts`, sobre `/dev/tips`.
 *
 * Es el único archivo que escribe tips. Sus pruebas van una detrás de otra:
 * primero la página sin ninguno y después con datos.
 */
import AxeBuilder from "@axe-core/playwright";

import { connectToLocalDatabase, type Database } from "../src/testing/database";
import {
  createTipRows,
  daysFromNow,
  type TipRows,
} from "../src/testing/tip-rows";
import { waitForSettledPage } from "./support/page-ready";
import { expect, test, type Page } from "./support/test";

const APP_URL = process.env.APP_URL ?? "http://localhost:3740";
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const DESKTOP = VIEWPORTS[3];
const PAGE_SIZE = 20;
const PREFIX = "prueba-tips-pagina";
// Dos de recepción básica y el resto de saque intermedio: 25 en total.
const RECEPTION_TITLES = ["Recepción de antebrazos", "Recepción en carrera"];
const SERVE_COUNT = 23;
const TOTAL = RECEPTION_TITLES.length + SERVE_COUNT;

let database: Database;
let tips: TipRows;

test.beforeAll(() => {
  database = connectToLocalDatabase();
  tips = createTipRows(database, PREFIX);
});

test.afterAll(async () => {
  await tips.removeAll();
  await database.end();
});

test.use({ locale: "es-CO" });

async function seedTips(): Promise<void> {
  for (const [position, title] of RECEPTION_TITLES.entries()) {
    await tips.insert({
      fundamental: "reception",
      level: "basic",
      publishedAt: daysFromNow(-(position + 1)),
      translations: {
        es: { title, achievement: "Recibe sin que el balón se escape" },
      },
    });
  }
  for (let number = 1; number <= SERVE_COUNT; number += 1) {
    await tips.insert({
      fundamental: "serve",
      level: "intermediate",
      publishedAt: daysFromNow(-(number + RECEPTION_TITLES.length)),
      translations: {
        es: { title: `Saque número ${number}` },
        en: { title: `Serve number ${number}` },
      },
    });
  }
}

interface Failure {
  readonly what: string;
  readonly start: (page: Page) => Promise<unknown>;
  readonly stop: (page: Page) => Promise<unknown>;
}

function isTipsData(url: URL): boolean {
  return url.pathname.endsWith("/tips.data");
}

async function setSearchPermission(change: "grant" | "revoke"): Promise<void> {
  const target = change === "grant" ? "to" : "from";
  await database.unsafe(
    `${change} execute on function public.search_public_tips(
      text, text, public.tip_fundamental, public.tip_level
    ) ${target} anon`,
  );
}

function gridCards(page: Page): ReturnType<Page["locator"]> {
  return page.locator('main ul > li > a[href*="/tips/"]');
}

async function openTips(page: Page, path: string): Promise<void> {
  const response = await page.goto(`${APP_URL}${path}`);
  expect(response?.status()).toBe(200);
  await waitForSettledPage(page);
}

async function expectAccessibleWithoutOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow, "hay desborde horizontal").toBe(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

interface PageState {
  readonly name: string;
  readonly path: string;
  readonly text: string;
}

function describeStates(states: readonly PageState[]): void {
  for (const { name, path, text } of states) {
    for (const viewport of VIEWPORTS) {
      test.describe(`${name} @ ${viewport.width}`, () => {
        test.use({ viewport });

        test("se lee sin scroll horizontal y sin violaciones de axe", async ({
          page,
        }) => {
          await openTips(page, path);
          await expect(page.getByRole("main")).toContainText(text);

          await expectAccessibleWithoutOverflow(page);
        });
      });
    }
  }
}

test.describe("sin tips publicados", () => {
  test.beforeAll(async () => {
    // La base local es desechable: no puede quedar ninguno.
    await database`delete from public.tips`;
  });

  describeStates([
    {
      name: "es sin tips",
      path: "/tips",
      text: "Todavía no hay tips publicados.",
    },
    {
      name: "en sin tips",
      path: "/en/tips",
      text: "There are no published tips yet.",
    },
  ]);
});

test.describe("con tips publicados", () => {
  test.beforeAll(seedTips);
  test.afterAll(() => tips.removeAll());

  describeStates([
    { name: "es con datos", path: "/tips", text: "Último video" },
    {
      name: "es filtrado",
      path: "/tips?fundamento=recepcion&nivel=basico",
      text: "2 resultados",
    },
    {
      name: "es sin resultados",
      path: "/tips?buscar=zzzz",
      text: "Quitar filtros",
    },
    { name: "en con datos", path: "/en/tips", text: "Latest video" },
    {
      name: "en filtrado",
      path: "/en/tips?skill=reception&level=basic",
      text: "2 results",
    },
    {
      name: "en sin resultados",
      path: "/en/tips?search=zzzz",
      text: "Clear filters",
    },
  ]);

  test.describe("en computador", () => {
    test.use({ viewport: DESKTOP });

    test("AC-024: los filtros quedan en la dirección y al recargar se conservan", async ({
      page,
    }) => {
      await openTips(page, "/tips");
      const skill = page.getByRole("navigation", { name: "Fundamento" });
      const level = page.getByRole("navigation", { name: "Nivel" });

      await skill.getByRole("link", { name: "Recepción" }).click();
      await expect(page).toHaveURL(/\/tips\?fundamento=recepcion$/);
      await level.getByRole("link", { name: "Básico" }).click();
      await expect(page).toHaveURL(
        /\/tips\?fundamento=recepcion&nivel=basico$/,
      );
      await expect(gridCards(page)).toHaveCount(2);
      await expect(page.getByText("Último video")).toHaveCount(0);

      await page.reload();
      await waitForSettledPage(page);

      await expect(gridCards(page)).toHaveCount(2);
      await expect(
        skill.getByRole("link", { name: "Recepción" }),
      ).toHaveAttribute("aria-current", "true");
      await expect(level.getByRole("link", { name: "Básico" })).toHaveAttribute(
        "aria-current",
        "true",
      );

      await skill.getByRole("link", { name: "Todos los fundamentos" }).click();
      await expect(page).toHaveURL(/\/tips\?nivel=basico$/);
    });

    test("los filtros se eligen con el teclado", async ({ page }) => {
      await openTips(page, "/tips");
      const reception = page.getByRole("link", {
        name: "Recepción",
        exact: true,
      });

      await reception.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/fundamento=recepcion/);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Colocación", exact: true }),
      ).toBeFocused();
    });

    test("la búsqueda no distingue tildes y se combina con el filtro", async ({
      page,
    }) => {
      await openTips(page, "/tips?nivel=basico");
      const search = page.getByRole("searchbox", { name: "Buscar" });

      await search.fill("RECEPCION en");
      await search.press("Enter");

      await expect(page).toHaveURL(/nivel=basico&buscar=RECEPCION\+en$/);
      await expect(gridCards(page)).toHaveCount(1);
      await expect(search).toHaveValue("RECEPCION en");
      await openTips(page, "/tips?buscar=zzzz");
      await page.getByRole("link", { name: "Quitar filtros" }).click();
      await expect(page).toHaveURL(/\/tips$/);
      await expect(search).toHaveValue("");
    });

    test("en inglés encuentra por el texto en español un tip sin inglés", async ({
      page,
    }) => {
      await openTips(page, "/en/tips?search=antebrazos");

      await expect(gridCards(page)).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "Recepción de antebrazos" }),
      ).toHaveAttribute("lang", "es");
    });

    test("cambiar de idioma conserva los filtros", async ({ page }) => {
      await openTips(page, "/tips?fundamento=recepcion&nivel=basico");

      await page
        .getByRole("banner")
        .getByRole("link", { name: "English" })
        .click();

      await expect(page).toHaveURL(/\/en\/tips\?skill=reception&level=basic$/);
      await expect(gridCards(page)).toHaveCount(2);
    });

    test("el menú marca Tips como la página actual", async ({ page }) => {
      await openTips(page, "/tips");

      await expect(
        page.getByRole("banner").getByRole("link", { name: "Tips" }),
      ).toHaveAttribute("aria-current", "page");
    });

    test("un filtro que no existe se ignora", async ({ page }) => {
      await openTips(page, "/tips?fundamento=magia");

      await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
      await expect(page.getByText("Último video")).toBeVisible();
    });

    test("'Cargar más tips' agrega los siguientes sin perder los que estaban", async ({
      page,
    }) => {
      await openTips(page, "/tips");
      await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
      const firstHref = await gridCards(page).first().getAttribute("href");

      await page.getByRole("link", { name: "Cargar más tips" }).press("Enter");

      await expect(gridCards(page)).toHaveCount(TOTAL);
      await expect(gridCards(page).first()).toHaveAttribute(
        "href",
        firstHref ?? "",
      );
      await expect(page).toHaveURL(/\/tips$/);
      await expect(
        page.getByRole("link", { name: "Cargar más tips" }),
      ).toHaveCount(0);
      // El enlace desapareció: el foco pasa al primero que llegó.
      await expect(gridCards(page).nth(PAGE_SIZE)).toBeFocused();
      await expect(page.getByText("Se agregaron 5 tips.")).toBeAttached();
    });

    test("lo cargado sigue ahí al saltar al contenido", async ({ page }) => {
      await openTips(page, "/tips?nivel=intermedio");
      await page.getByRole("link", { name: "Cargar más tips" }).click();
      await expect(gridCards(page)).toHaveCount(SERVE_COUNT);

      const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
      await skipLink.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#contenido$/);

      await expect(gridCards(page)).toHaveCount(SERVE_COUNT);
    });

    test("lo cargado en un idioma no pasa al otro", async ({ page }) => {
      await openTips(page, "/tips");
      await page.getByRole("link", { name: "Cargar más tips" }).click();
      await expect(gridCards(page)).toHaveCount(TOTAL);

      await page
        .getByRole("banner")
        .getByRole("link", { name: "English" })
        .click();

      await expect(page).toHaveURL(/\/en\/tips$/);
      await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
      await expect(
        page.getByRole("link", { name: "Load more tips" }),
      ).toHaveAttribute("href", "/en/tips?page=2");
    });

    const failures: readonly Failure[] = [
      {
        what: "la red",
        start: (page) =>
          page.route(isTipsData, (route) =>
            route.abort("internetdisconnected"),
          ),
        stop: (page) => page.unroute(isTipsData),
      },
      // Falla de verdad en el servidor: sin permiso sobre la búsqueda, la
      // lectura de los tips lanza.
      {
        what: "el servidor",
        start: () => setSearchPermission("revoke"),
        stop: () => setSearchPermission("grant"),
      },
    ];

    for (const { what, start, stop } of failures) {
      test(`si falla ${what} al cargar más, los tips siguen y se puede reintentar`, async ({
        page,
      }) => {
        await openTips(page, "/tips");
        const loadMore = page.getByRole("link", { name: "Cargar más tips" });
        try {
          await start(page);

          await loadMore.click();

          await expect(
            page.getByText("No pudimos cargar más tips. Intenta de nuevo."),
          ).toBeVisible();
          await expect(page).toHaveURL(/\/tips$/);
          await expect(gridCards(page)).toHaveCount(PAGE_SIZE);
          await expectAccessibleWithoutOverflow(page);
        } finally {
          await stop(page);
        }

        await loadMore.click();

        await expect(gridCards(page)).toHaveCount(TOTAL);
        await expect(page.getByText("No pudimos cargar más tips")).toHaveCount(
          0,
        );
      });
    }

    test.describe("sin JavaScript", () => {
      test.use({ javaScriptEnabled: false });

      test("'Cargar más tips' es un enlace a la página siguiente", async ({
        page,
      }) => {
        await page.goto(`${APP_URL}/tips`);

        await page.getByRole("link", { name: "Cargar más tips" }).click();

        await expect(page).toHaveURL(/\/tips\?pagina=2$/);
        await expect(gridCards(page)).toHaveCount(TOTAL - PAGE_SIZE);
        await expect(
          page.getByRole("link", { name: "Cargar más tips" }),
        ).toHaveCount(0);
      });

      test("la búsqueda y los filtros funcionan", async ({ page }) => {
        await page.goto(`${APP_URL}/tips?fundamento=recepcion`);

        await page.getByRole("searchbox", { name: "Buscar" }).fill("carrera");
        await page.getByRole("button", { name: "Buscar tips" }).click();

        await expect(page).toHaveURL(/fundamento=recepcion&buscar=carrera$/);
        await expect(gridCards(page)).toHaveCount(1);
      });
    });
  });

  test.describe("en tableta", () => {
    test.use({ viewport: VIEWPORTS[2] });

    test("la píldora de nivel abraza sus opciones", async ({ page }) => {
      await openTips(page, "/tips");
      const level = page.getByRole("navigation", { name: "Nivel" });

      const pill = await level.getByRole("list").boundingBox();
      const last = await level
        .getByRole("link", { name: "Avanzado" })
        .boundingBox();

      const pillEnd = (pill?.x ?? 0) + (pill?.width ?? 0);
      const lastEnd = (last?.x ?? 0) + (last?.width ?? 0);
      expect(pillEnd - lastEnd).toBeLessThanOrEqual(8);
    });
  });

  test.describe("en celular", () => {
    test.use({ viewport: VIEWPORTS[0] });

    test("la fila de fundamentos deja a la vista el elegido", async ({
      page,
    }) => {
      await openTips(page, "/tips?fundamento=defensa");

      await expect(page.getByRole("link", { name: "Defensa" })).toBeInViewport({
        ratio: 1,
      });
    });

    test("el filtro enfocado con el teclado se ve entero", async ({ page }) => {
      await openTips(page, "/tips");
      const skill = page.getByRole("navigation", { name: "Fundamento" });
      await skill.getByRole("link", { name: "Todos los fundamentos" }).focus();

      for (const name of ["Saque", "Recepción", "Colocación"]) {
        await page.keyboard.press("Tab");
        const option = skill.getByRole("link", { name, exact: true });
        await expect(option).toBeFocused();
        await expect(option).toBeInViewport({ ratio: 1 });
      }
    });

    test("una miniatura que no carga deja solo el recuadro", async ({
      page,
    }) => {
      await page.route("https://miniaturas.prueba.volleytip.test/**", (route) =>
        route.fulfill({ status: 404 }),
      );
      await openTips(page, "/tips");

      await expect(gridCards(page).first().locator("img")).toHaveCSS(
        "opacity",
        "0",
      );
    });

    test("las opciones de filtro miden 44 px o más y las tarjetas van en dos columnas", async ({
      page,
    }) => {
      await openTips(page, "/tips");

      for (const option of await page.locator("[data-tips-filters] a").all()) {
        const box = await option.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
      const boxes = await Promise.all(
        [0, 1, 2].map((index) => gridCards(page).nth(index).boundingBox()),
      );
      expect(boxes[1]?.y).toBe(boxes[0]?.y);
      expect(boxes[2]?.y).toBeGreaterThan(boxes[0]?.y ?? 0);
    });
  });
});
