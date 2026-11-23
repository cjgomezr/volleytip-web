import {
  InvalidSettingError,
  readSetting,
  type SettingDefinition,
} from "./settings.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

export const APP_AVAILABILITY_KEY = "app_availability";

// Solo las tiendas oficiales: el botón lleva a la persona a instalar algo, y
// una dirección de otro dominio sería un enlace a cualquier parte.
const APP_STORE_PREFIX = "https://apps.apple.com/";
const PLAY_STORE_PREFIX = "https://play.google.com/";

/** La forma del ajuste `settings.app_availability`. */
export interface AppAvailabilitySetting {
  readonly status: "waitlist" | "available";
  readonly appStoreUrl?: string;
  readonly playStoreUrl?: string;
}

/** Lo que la página pinta: o el formulario, o los botones que existan. */
export type AppAvailability =
  | { readonly state: "waitlist" }
  | {
      readonly state: "available";
      readonly appStoreUrl: string | null;
      readonly playStoreUrl: string | null;
    };

const WAITLIST: AppAvailability = { state: "waitlist" };

function isOptionalStoreUrl(value: unknown, prefix: string): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && value.startsWith(prefix))
  );
}

export const APP_AVAILABILITY_SETTING: SettingDefinition<AppAvailabilitySetting> =
  {
    key: APP_AVAILABILITY_KEY,
    isValid: (value): value is AppAvailabilitySetting => {
      if (typeof value !== "object" || value === null || !("status" in value)) {
        return false;
      }
      if (value.status !== "waitlist" && value.status !== "available") {
        return false;
      }
      const appStoreUrl =
        "appStoreUrl" in value ? value.appStoreUrl : undefined;
      const playStoreUrl =
        "playStoreUrl" in value ? value.playStoreUrl : undefined;
      return (
        isOptionalStoreUrl(appStoreUrl, APP_STORE_PREFIX) &&
        isOptionalStoreUrl(playStoreUrl, PLAY_STORE_PREFIX)
      );
    },
    fallback: { status: "waitlist" },
  };

/** "Disponible" sin ninguna dirección no tiene botones que pintar: la
 * página sigue pidiendo el correo. */
export function resolveAppAvailability(
  setting: AppAvailabilitySetting,
): AppAvailability {
  if (setting.status === "waitlist") return WAITLIST;
  const appStoreUrl = setting.appStoreUrl ?? null;
  const playStoreUrl = setting.playStoreUrl ?? null;
  if (appStoreUrl === null && playStoreUrl === null) return WAITLIST;
  return { state: "available", appStoreUrl, playStoreUrl };
}

/**
 * Lee si la app ya salió. Sin ajuste, con una forma inválida o "disponible"
 * sin direcciones, la página queda en lista de espera: una app anunciada sin
 * botones sería peor que seguir juntando correos. El error de forma queda en
 * el registro. Un fallo de la base sí se lanza.
 */
export async function readAppAvailability(
  client?: TypedSupabaseClient,
): Promise<AppAvailability> {
  try {
    return resolveAppAvailability(
      await readSetting(APP_AVAILABILITY_SETTING, client),
    );
  } catch (error) {
    if (!(error instanceof InvalidSettingError)) throw error;
    console.error(error.message);
    return WAITLIST;
  }
}
