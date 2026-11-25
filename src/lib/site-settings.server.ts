import { createContext } from "react-router";

import {
  ANNOUNCEMENT_BAR_SETTING,
  type AnnouncementMessage,
} from "./announcement-bar.server";
import {
  MAINTENANCE_MODE_SETTING,
  type MaintenanceMode,
} from "./maintenance-mode.server";
import {
  rawSetting,
  readSettings,
  type SettingDefinition,
} from "./settings.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

/** Los ajustes que lee cada petición a una página: el modo mantenimiento y
 * la barra de anuncios. */
export interface SiteSettings {
  readonly maintenance: MaintenanceMode;
  readonly announcements: readonly AnnouncementMessage[];
}

/** Lo que cada petición lee una vez, en el middleware de la raíz, y las
 * páginas consumen. Sin valor por defecto: leerlo sin middleware es un bug. */
export const siteSettingsContext = createContext<SiteSettings>();

/** Lo máximo que una página espera a la base por los ajustes. Pasado ese
 * tiempo sale normal y sin barra: un aviso no vale una página lenta. */
export const SITE_SETTINGS_TIMEOUT_MS = 1500;

/** Con la base caída o un ajuste malo, el sitio sigue arriba: el
 * mantenimiento nunca se enciende por un fallo de lectura. */
const SAFE_SITE_SETTINGS: SiteSettings = {
  maintenance: MAINTENANCE_MODE_SETTING.fallback,
  announcements: ANNOUNCEMENT_BAR_SETTING.fallback,
};

// Se lee el valor crudo y cada ajuste se valida por separado: una barra mal
// guardada no puede apagar un mantenimiento bien guardado, ni al revés.
function parseSetting<Value>(
  definition: SettingDefinition<Value>,
  raw: unknown,
): Value {
  if (raw === undefined) return definition.fallback;
  if (definition.isValid(raw)) return raw;
  console.error(
    `El ajuste "${definition.key}" tiene un valor guardado que no cumple la forma esperada. Corrígelo en la tabla settings.`,
  );
  return definition.fallback;
}

export async function giveUpAfter<Result>(
  limitMs: number,
  work: Promise<Result>,
): Promise<Result> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`La base no respondió en ${limitMs} ms`));
    }, limitMs);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lee los ajustes del sitio en una sola consulta, sin guardarlos en memoria
 * (AC-021: apagar el modo se nota en la petición siguiente). Si la base falla
 * o no responde a tiempo, registra el error y devuelve el sitio normal.
 */
export async function loadSiteSettings(
  client?: TypedSupabaseClient,
): Promise<SiteSettings> {
  try {
    const raw = await giveUpAfter(
      SITE_SETTINGS_TIMEOUT_MS,
      readSettings(
        {
          maintenance: rawSetting(MAINTENANCE_MODE_SETTING.key),
          announcements: rawSetting(ANNOUNCEMENT_BAR_SETTING.key),
        },
        client,
      ),
    );
    return {
      maintenance: parseSetting(MAINTENANCE_MODE_SETTING, raw.maintenance),
      announcements: parseSetting(ANNOUNCEMENT_BAR_SETTING, raw.announcements),
    };
  } catch (error) {
    console.error("No se pudieron leer los ajustes del sitio", error);
    return SAFE_SITE_SETTINGS;
  }
}
