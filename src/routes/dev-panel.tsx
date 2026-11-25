import type { ReactElement } from "react";
import { data, redirect } from "react-router";

import { PanelHeading } from "~/components/panel/panel-heading";
import { PanelMore } from "~/components/panel/panel-more";
import { PanelShell } from "~/components/panel/panel-shell";
import { getPanelPathInLanguage } from "~/lib/admin/path-in-language";
import {
  FULL_BAR_SAMPLE,
  SAMPLE_MODULES,
  SAMPLE_MORE_PAGE,
} from "~/lib/admin/sample-modules";
import { serverEnv } from "~/lib/env.server";
import { getDocumentPath } from "~/lib/i18n/document-path";
import {
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type Language,
} from "~/lib/i18n/languages";
import {
  buildPagePath,
  findPageAtPath,
  type PageDeclaration,
} from "~/lib/i18n/page-path";
import { findLanguage } from "~/lib/i18n/pages";
import type { MessageKey } from "~/lib/i18n/translate";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import type { Route } from "./+types/dev-panel";

// Pinta la cáscara del panel con módulos de muestra, sin sesión ni base, para
// verla llena y capturarla en Playwright. `?mantenimiento=1` pinta la franja y
// `?barra=llena`, la barra con sus cinco lugares. En producción responde 404.
const NOT_FOUND_STATUS = 404;
const BAD_REQUEST = 400;
const SEE_OTHER = 303;
const MAINTENANCE_PARAM = "mantenimiento";
const SAMPLE_PENDING_COUNTS = { "sample-messages": 3 } as const;

const SAMPLE_PAGES: readonly PageDeclaration[] = [
  ...SAMPLE_MODULES.map(({ page }) => page),
  SAMPLE_MORE_PAGE,
];

interface DevPanel {
  readonly isMore: boolean;
  /** El nombre de la sección que se pinta; en "Más" no se usa. */
  readonly titleKey: MessageKey;
  readonly isMaintenanceOn: boolean;
  readonly isBarFull: boolean;
}

function rejectInProduction(): void {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
}

export function loader({ request }: Route.LoaderArgs): DevPanel {
  rejectInProduction();
  const url = new URL(request.url);
  const page = findPageAtPath(
    getDocumentPath(url),
    SAMPLE_PAGES,
    SUPPORTED_LANGUAGES,
  )?.page;
  if (page === undefined) throw data(null, { status: NOT_FOUND_STATUS });
  const module = SAMPLE_MODULES.find((candidate) => candidate.page === page);
  return {
    isMore: page === SAMPLE_MORE_PAGE,
    titleKey: module?.labelKey ?? "panel.nav.more",
    isMaintenanceOn: url.searchParams.get(MAINTENANCE_PARAM) === "1",
    isBarFull: url.searchParams.get("barra") === "llena",
  };
}

function getSampleHome(language: Language): string {
  return buildPagePath(
    { id: "sample-home", file: "", path: "dev/panel" },
    findLanguage(language),
  );
}

/** El selector de idioma de la muestra: cambia de pantalla sin guardar nada. */
export async function action({ request }: Route.ActionArgs): Promise<Response> {
  rejectInProduction();
  const formData = await request.formData();
  const language = formData.get("language");
  const from = formData.get("from");
  if (typeof language !== "string" || !isSupportedLanguage(language)) {
    throw data(null, { status: BAD_REQUEST });
  }
  const destination = getPanelPathInLanguage(
    typeof from === "string" ? from : "",
    language,
    { pages: SAMPLE_PAGES, fallback: getSampleHome(language) },
  );
  return redirect(destination, SEE_OTHER);
}

export default function DevPanelPage({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const sample = loaderData.isBarFull
    ? FULL_BAR_SAMPLE
    : { modules: SAMPLE_MODULES, pendingCounts: SAMPLE_PENDING_COUNTS };
  return (
    <PanelShell
      modules={sample.modules}
      member={{ displayName: "Andrés Gómez", role: "admin" }}
      pendingCounts={sample.pendingCounts}
      isMaintenanceOn={loaderData.isMaintenanceOn}
      morePath={buildPagePath(SAMPLE_MORE_PAGE, findLanguage(language))}
      languageAction={getSampleHome(language)}
    >
      {loaderData.isMore ? (
        <PanelMore />
      ) : (
        <PanelHeading title={translate(loaderData.titleKey)} />
      )}
    </PanelShell>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ name: "robots", content: "noindex" }];
}
