import type { ReactElement } from "react";
import { data } from "react-router";

import { PanelShell } from "~/components/panel/panel-shell";
import { MaintenanceConfirmation } from "~/components/panel/settings/maintenance-confirmation";
import {
  SettingsScreen,
  type SettingsScreenProps,
} from "~/components/panel/settings/settings-screen";
import { ADMIN_MODULES, type AdminModule } from "~/lib/admin/modules";
import {
  APP_FORM_ERROR_KEYS,
  type SettingsView,
} from "~/lib/admin/settings-view";
import { serverEnv } from "~/lib/env.server";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Route } from "./+types/dev-settings";

// Pinta "Ajustes" y la confirmación del mantenimiento en cada estado, sin
// sesión ni base, para capturarlos en Playwright:
// `?estado=apagado|encendido|invalido|errores|confirmar`. Solo pinta: no
// recibe envíos. En producción responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";

type Sample =
  | { readonly screen: "confirmation" }
  | ({ readonly screen: "settings"; readonly view: SettingsView } & Pick<
      SettingsScreenProps,
      "rejection"
    >);

const STORED_URL = "https://apps.apple.com/co/app/volleytip/id1234567890";

const OFF: SettingsView = {
  maintenance: "off",
  app: {
    state: "waitlist",
    values: { status: "waitlist", appStoreUrl: "", playStoreUrl: "" },
  },
  saved: null,
};

const SAMPLES: Readonly<Record<string, Sample>> = {
  apagado: { screen: "settings", view: OFF },
  encendido: {
    screen: "settings",
    view: {
      maintenance: "on",
      app: {
        state: "available",
        values: {
          status: "available",
          appStoreUrl: STORED_URL,
          playStoreUrl: "",
        },
      },
      saved: "maintenance",
    },
  },
  invalido: {
    screen: "settings",
    view: {
      maintenance: "invalid",
      app: {
        state: "invalid",
        values: { status: "available", appStoreUrl: "", playStoreUrl: "" },
      },
      saved: null,
    },
  },
  errores: {
    screen: "settings",
    view: OFF,
    rejection: {
      errors: {
        appStoreUrl: APP_FORM_ERROR_KEYS.appStoreUrl,
        playStoreUrl: APP_FORM_ERROR_KEYS.playStoreUrl,
      },
      values: {
        status: "available",
        appStoreUrl: "http://apps.apple.com/co/app/volleytip/id1234567890",
        playStoreUrl: "https://sitio-ajeno.test/volleytip",
      },
    },
  },
  confirmar: { screen: "confirmation" },
};

export function loader({ request }: Route.LoaderArgs): Sample {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const state = new URL(request.url).searchParams.get(STATE_PARAM) ?? "apagado";
  const sample = SAMPLES[state];
  if (sample === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  return sample;
}

// El menú real, con "Ajustes" apuntando aquí para que salga marcado.
const SAMPLE_MENU: readonly AdminModule[] = ADMIN_MODULES.map((module) =>
  module.id === "settings"
    ? {
        ...module,
        page: {
          id: "sample-settings",
          file: "routes/dev-settings.tsx",
          path: "dev/ajustes",
        },
      }
    : module,
);

export default function DevSettings({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const language = useLanguage();
  return (
    <PanelShell
      modules={SAMPLE_MENU}
      member={{ displayName: "Andrés Gómez", role: "admin" }}
      pendingCounts={{}}
      isMaintenanceOn={
        loaderData.screen === "settings" && loaderData.view.maintenance === "on"
      }
      morePath={getPanelPath("adminMore", language)}
      languageAction={getPanelPath("adminLanguage", language)}
    >
      {loaderData.screen === "confirmation" ? (
        <MaintenanceConfirmation />
      ) : (
        <SettingsScreen {...loaderData.view} rejection={loaderData.rejection} />
      )}
    </PanelShell>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
