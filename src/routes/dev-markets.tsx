import type { ReactElement } from "react";
import { data } from "react-router";

import {
  MarketsScreen,
  type MarketsScreenProps,
} from "~/components/panel/markets/markets-screen";
import { PanelShell } from "~/components/panel/panel-shell";
import { ADMIN_MODULES, type AdminModule } from "~/lib/admin/modules";
import { SAMPLE_MARKETS_VIEW } from "~/lib/admin/sample-markets";
import { serverEnv } from "~/lib/env.server";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Route } from "./+types/dev-markets";

// Pinta "Idiomas y mercados" sin sesión ni base, para capturarla en
// Playwright: `?estado=datos|ultimo-mercado|tasa-invalida`. Solo pinta: no
// recibe envíos. En producción responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";

function buildLastMarketSample(): MarketsScreenProps {
  return {
    ...SAMPLE_MARKETS_VIEW,
    marketOutcome: {
      status: "invalid",
      id: SAMPLE_MARKETS_VIEW.markets[0]?.id ?? "",
      values: {
        isActive: false,
        shipsPhysical: true,
        defaultLocale: "es",
        paymentMethods: ["card", "pse"],
      },
      errors: {},
      formError: "lastActiveMarket",
    },
  };
}

const SAMPLES: Readonly<Record<string, MarketsScreenProps>> = {
  datos: SAMPLE_MARKETS_VIEW,
  "ultimo-mercado": buildLastMarketSample(),
  "tasa-invalida": {
    ...SAMPLE_MARKETS_VIEW,
    rateOutcome: {
      status: "invalid",
      value: "4.150,5",
      error: "notPositiveInteger",
    },
  },
};

export function loader({ request }: Route.LoaderArgs): MarketsScreenProps {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const state = new URL(request.url).searchParams.get(STATE_PARAM) ?? "datos";
  const sample = SAMPLES[state];
  if (sample === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  return sample;
}

// El menú real, con "Idiomas y mercados" apuntando aquí para que salga
// marcado.
const SAMPLE_MENU: readonly AdminModule[] = ADMIN_MODULES.map((module) =>
  module.id === "markets"
    ? {
        ...module,
        page: {
          id: "sample-markets",
          file: "routes/dev-markets.tsx",
          path: "dev/mercados",
        },
      }
    : module,
);

export default function DevMarkets({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const language = useLanguage();
  return (
    <PanelShell
      modules={SAMPLE_MENU}
      member={{ displayName: "Andrés Gómez", role: "admin" }}
      pendingCounts={{}}
      isMaintenanceOn={false}
      morePath={getPanelPath("adminMore", language)}
      languageAction={getPanelPath("adminLanguage", language)}
    >
      <MarketsScreen {...loaderData} />
    </PanelShell>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
