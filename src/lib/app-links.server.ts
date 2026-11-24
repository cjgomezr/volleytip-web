import {
  InvalidSettingError,
  readSetting,
  type SettingDefinition,
} from "./settings.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

export const APP_LINKS_KEY = "app_links";

/** Los datos que Android pide para abrir enlaces en la app. */
export interface AndroidAppLink {
  readonly packageName: string;
  readonly sha256CertFingerprints: readonly string[];
}

/** Los datos que Apple pide: cada `appId` es `<TeamID>.<bundle id>`. */
export interface IosAppLink {
  readonly appIds: readonly string[];
}

/** La forma del ajuste `settings.app_links`. Cada plataforma es opcional:
 * se llena cuando exista su app. */
export interface AppLinksSetting {
  readonly android?: AndroidAppLink;
  readonly ios?: IosAppLink;
}

const NO_APP_LINKS: AppLinksSetting = {};
// Las rutas que la app abre: `/r/<código>` en los dos idiomas.
const APP_LINK_COMPONENTS = [{ "/": "/r/*" }, { "/": "/en/r/*" }];
const ANDROID_RELATION = "delegate_permission/common.handle_all_urls";

function isNonEmptyStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item !== "")
  );
}

function isAndroidAppLink(value: unknown): value is AndroidAppLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "packageName" in value &&
    typeof value.packageName === "string" &&
    value.packageName !== "" &&
    "sha256CertFingerprints" in value &&
    isNonEmptyStringList(value.sha256CertFingerprints)
  );
}

function isIosAppLink(value: unknown): value is IosAppLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "appIds" in value &&
    isNonEmptyStringList(value.appIds)
  );
}

export const APP_LINKS_SETTING: SettingDefinition<AppLinksSetting> = {
  key: APP_LINKS_KEY,
  isValid: (value): value is AppLinksSetting => {
    if (typeof value !== "object" || value === null) return false;
    const android = "android" in value ? value.android : undefined;
    const ios = "ios" in value ? value.ios : undefined;
    return (
      (android === undefined || isAndroidAppLink(android)) &&
      (ios === undefined || isIosAppLink(ios))
    );
  },
  fallback: NO_APP_LINKS,
};

/**
 * Lee los identificadores de la app. Los dos archivos de `.well-known` los
 * piden los teléfonos sin que nadie los vea: ante una forma inválida o una
 * base que no responde devuelve "sin datos" y deja el error en el registro,
 * en vez de romper el archivo.
 */
export async function readAppLinks(
  client?: TypedSupabaseClient,
): Promise<AppLinksSetting> {
  try {
    return await readSetting(APP_LINKS_SETTING, client);
  } catch (error) {
    console.error(
      error instanceof InvalidSettingError
        ? error.message
        : `No se pudieron leer los enlaces de la app: ${String(error)}`,
    );
    return NO_APP_LINKS;
  }
}

/** El cuerpo de `/.well-known/assetlinks.json` (Android). */
export function buildAssetLinks(setting: AppLinksSetting): unknown[] {
  if (setting.android === undefined) return [];
  return [
    {
      relation: [ANDROID_RELATION],
      target: {
        namespace: "android_app",
        package_name: setting.android.packageName,
        sha256_cert_fingerprints: setting.android.sha256CertFingerprints,
      },
    },
  ];
}

/** El cuerpo de `/.well-known/apple-app-site-association` (iOS). */
export function buildAppSiteAssociation(setting: AppLinksSetting): {
  applinks: { details: unknown[] };
} {
  if (setting.ios === undefined) return { applinks: { details: [] } };
  return {
    applinks: {
      details: [
        {
          appIDs: setting.ios.appIds,
          components: APP_LINK_COMPONENTS,
        },
      ],
    },
  };
}
