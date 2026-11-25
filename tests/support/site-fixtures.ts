import type { LocalSupabaseStatus } from "../../src/testing/local-supabase-status";
import { removeSettingRows } from "./settings-rows";

/**
 * Los datos de la base que las pruebas de Playwright esperan ver en las
 * páginas. Se escriben antes de cada corrida (`seedSiteFixtures`), así que
 * las pruebas no dependen de lo que haya dejado en la base local una
 * migración, otra prueba o una corrida a medias.
 */
export const ANNOUNCEMENT_FIXTURES = [
  {
    es: "En vivo: nuevo tip cada semana",
    en: "Live: a new tip every week",
  },
  {
    es: "Volleyball Camp · próximamente",
    en: "Volleyball Camp · coming soon",
  },
  {
    es: "Envío gratis en Colombia desde $200.000",
    en: "Free shipping in Colombia from COP 200,000",
  },
] as const;

const SETTINGS_FIXTURES = [
  {
    key: "announcement_bar",
    value: ANNOUNCEMENT_FIXTURES.map((text) => ({ text })),
  },
] as const;

function buildHeaders(status: LocalSupabaseStatus): Record<string, string> {
  return {
    apikey: status.SECRET_KEY,
    Authorization: `Bearer ${status.SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Quita de la base local los ajustes que sembró la corrida. La base queda
 * como la dejan las migraciones, que es lo que esperan las pruebas de
 * integración. */
export async function removeSiteFixtures(
  status: LocalSupabaseStatus,
): Promise<void> {
  const keys = SETTINGS_FIXTURES.map(({ key }) => key).join(",");
  const response = await fetch(
    `${status.API_URL}/rest/v1/settings?key=in.(${keys})`,
    { method: "DELETE", headers: buildHeaders(status) },
  );
  if (!response.ok) {
    throw new Error(
      `No se pudieron quitar los datos de las pruebas (${response.status}): ${await response.text()}`,
    );
  }
}

// Los formularios que las pruebas envían, por el nombre con que cada uno
// lleva su cuenta de envíos.
const SUBMITTED_FORMS = [
  "camp_notify",
  "app_waitlist",
  "contact",
  "admin_sign_in",
] as const;

/** Las pruebas de los formularios envían desde la misma IP; sin esto, varias
 * corridas seguidas chocarían con el límite de 5 envíos cada 10 minutos. */
async function resetFormRateLimits(status: LocalSupabaseStatus): Promise<void> {
  for (const form of SUBMITTED_FORMS) {
    const response = await fetch(
      `${status.API_URL}/rest/v1/rate_limits?key=like.${form}:*`,
      { method: "DELETE", headers: buildHeaders(status) },
    );
    if (!response.ok) {
      throw new Error(
        `No se pudo reiniciar el límite de envíos de ${form} (${response.status}): ${await response.text()}`,
      );
    }
  }
}

/** Deja en la base local los ajustes que las pruebas esperan. Si la base no
 * los acepta, falla: una corrida sin sus datos no comprueba nada. */
export async function seedSiteFixtures(
  status: LocalSupabaseStatus,
): Promise<void> {
  await resetFormRateLimits(status);
  // Una corrida cortada a medias pudo dejar el sitio en mantenimiento.
  await removeSettingRows(status, ["maintenance_mode"]);
  const response = await fetch(
    `${status.API_URL}/rest/v1/settings?on_conflict=key`,
    {
      method: "POST",
      headers: {
        ...buildHeaders(status),
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(SETTINGS_FIXTURES),
    },
  );
  if (!response.ok) {
    throw new Error(
      `No se pudieron sembrar los datos de las pruebas (${response.status}): ${await response.text()}`,
    );
  }
}
