import type { ReactElement } from "react";
import { data } from "react-router";

import { serverEnv } from "~/lib/env.server";
import type { AppAvailability } from "~/lib/app-availability.server";
import type { WaitlistOutcome } from "~/lib/forms/waitlist-form.server";
import {
  WAITLIST_ERROR_KEYS,
  WAITLIST_FORM,
} from "~/lib/forms/waitlist-form.server";
import { issueFormProtection } from "~/lib/forms/protected-form.server";

import type { Route } from "./+types/dev-app";
import { AppPage } from "./app-page";

// Pinta la página de la app en cada uno de sus estados sin tocar la base, para
// capturarla en Playwright: `?estado=disponible` (con `&tienda=app`, `play` o
// ambas por omisión) y `?resultado=unido|invalido|rechazado`. Solo pinta: el
// formulario sigue enviando a /app. En producción responde 404.
const NOT_FOUND_STATUS = 404;
const SAMPLE_APP_STORE_URL = "https://apps.apple.com/app/volleytip/id0";
const SAMPLE_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.volleytip";

const OUTCOMES: Readonly<Record<string, WaitlistOutcome>> = {
  unido: { status: "joined" },
  invalido: {
    status: "invalid",
    fieldErrors: { email: WAITLIST_ERROR_KEYS.emailInvalid },
    values: { email: "ana@", country: "MX" },
  },
  rechazado: { status: "rejected", reason: "rate_limited" },
};

function readAvailability(params: URLSearchParams): AppAvailability {
  if (params.get("estado") !== "disponible") return { state: "waitlist" };
  const store = params.get("tienda");
  return {
    state: "available",
    appStoreUrl: store === "play" ? null : SAMPLE_APP_STORE_URL,
    playStoreUrl: store === "app" ? null : SAMPLE_PLAY_STORE_URL,
  };
}

export function loader({ request }: Route.LoaderArgs): {
  readonly availability: AppAvailability;
  readonly outcome: WaitlistOutcome | undefined;
  readonly protection: ReturnType<typeof issueFormProtection>;
} {
  if (serverEnv.appEnv === "production") {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  const params = new URL(request.url).searchParams;
  return {
    availability: readAvailability(params),
    outcome: OUTCOMES[params.get("resultado") ?? ""],
    protection: issueFormProtection(WAITLIST_FORM),
  };
}

export default function DevApp({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <AppPage {...loaderData} />;
}
