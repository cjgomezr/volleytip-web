import type { ReactElement } from "react";

import { getRequestLanguage } from "~/lib/i18n/languages";

import type { Route } from "./+types/privacy";
import {
  LegalPage,
  buildLegalMeta,
  buildLegalPageData,
  type LegalPageData,
} from "./legal-page";

export function loader({ request }: Route.LoaderArgs): LegalPageData {
  return buildLegalPageData("privacy", getRequestLanguage(request));
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return buildLegalMeta(loaderData);
}

export default function Privacy({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <LegalPage {...loaderData} />;
}
