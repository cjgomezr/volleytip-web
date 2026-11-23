import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, type Theme } from "./matrix.ts";

const CONFIG_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "factory-models.json",
);
const SETTING = "review.themes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

/**
 * Los temas que captura la revisión visual, según `review.themes` de
 * `factory-models.json`. Sin ese ajuste son los dos. Un proyecto con un solo
 * tema lo declara ahí (`["light"]`): si no, sus capturas en claro y en oscuro
 * salen idénticas y la revisión no puede pasar nunca.
 */
export function parseReviewThemes(config: unknown): readonly Theme[] {
  const review = isRecord(config) ? config.review : undefined;
  const configured = isRecord(review) ? review.themes : undefined;
  if (configured === undefined) return THEMES;

  if (!Array.isArray(configured) || configured.length === 0) {
    throw new Error(
      `${SETTING} debe ser una lista con al menos un tema (${THEMES.join(", ")}).`,
    );
  }
  const unknownTheme = configured.find((theme) => !isTheme(theme));
  if (unknownTheme !== undefined) {
    throw new Error(
      `${SETTING} trae un tema que no existe: "${String(unknownTheme)}". Los válidos son ${THEMES.join(", ")}.`,
    );
  }
  if (new Set(configured).size !== configured.length) {
    throw new Error(`${SETTING} repite un tema.`);
  }
  return configured.filter(isTheme);
}

export async function readReviewThemes(): Promise<readonly Theme[]> {
  const config: unknown = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  return parseReviewThemes(config);
}

// Dos capturas idénticas significan que el tema no llegó a aplicarse, y un
// revisor que compare la misma imagen dos veces aprueba lo que nunca vio.
export function assertThemesDiffer(
  viewportName: string,
  byTheme: ReadonlyMap<Theme, Buffer>,
): void {
  const [light, dark] = [byTheme.get("light"), byTheme.get("dark")];
  if (light && dark && light.equals(dark)) {
    throw new Error(
      `Las capturas de ${viewportName} en claro y en oscuro son idénticas: el tema no se aplicó. Si el proyecto tiene un solo tema, decláralo en ${SETTING} de factory-models.json (por ejemplo ["light"]).`,
    );
  }
}
