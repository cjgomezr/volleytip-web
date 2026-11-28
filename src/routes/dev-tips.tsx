import type { ReactElement } from "react";
import { data } from "react-router";

import { serverEnv } from "~/lib/env.server";
import { getRequestLanguage, type Language } from "~/lib/i18n/languages";
import { TIP_FUNDAMENTALS, TIP_LEVELS } from "~/lib/tips";
import type { TipCardData, TipsListing } from "~/lib/tips-listing.server";

import type { Route } from "./+types/dev-tips";
import { TipsPage } from "./tips-page";

// Pinta el listado de tips sin tocar la base, para capturarlo en Playwright:
// con datos por omisión y con `?estado=` filtrado, sin-resultados o vacio. En
// producción responde 404.
const NOT_FOUND_STATUS = 404;
const STATE_PARAM = "estado";
const SAMPLE_PUBLISHED_TOTAL = 105;
const SAMPLE_CARD_COUNT = 10;
const SAMPLE_DURATIONS = [38, 52, 45, 62, 31] as const;
const SAMPLE_THUMBNAIL = "/brand/mark.png";

const SAMPLE_TITLES: Readonly<Record<Language, readonly string[]>> = {
  es: [
    "Saque flotado sin efecto",
    "Recibe con los brazos firmes",
    "Colocación de espaldas",
    "La carrera de ataque en tres pasos",
    "Bloqueo: manos por encima de la red",
  ],
  en: [
    "Float serve with no spin",
    "Receive with a firm platform",
    "Back set",
    "The three step attack approach",
    "Block: hands over the net",
  ],
};

// La última tarjeta cae al español, como un tip sin textos en inglés.
function buildCard(number: number, language: Language): TipCardData {
  const isFallback = number === SAMPLE_CARD_COUNT - 1;
  const titleLanguage = isFallback ? "es" : language;
  const titles = SAMPLE_TITLES[titleLanguage];
  return {
    id: `dev-${number}`,
    slug: `muestra-${number}`,
    title: titles[number % titles.length] ?? "",
    titleLanguage,
    thumbnailUrl: SAMPLE_THUMBNAIL,
    durationSeconds: SAMPLE_DURATIONS[number % SAMPLE_DURATIONS.length] ?? 0,
    fundamental: TIP_FUNDAMENTALS[number % TIP_FUNDAMENTALS.length] ?? "serve",
    level: TIP_LEVELS[number % TIP_LEVELS.length] ?? "basic",
  };
}

function buildSampleListing(language: Language): TipsListing {
  return {
    query: { query: "", page: 1 },
    publishedTotal: SAMPLE_PUBLISHED_TOTAL,
    total: SAMPLE_PUBLISHED_TOTAL,
    tips: Array.from({ length: SAMPLE_CARD_COUNT }, (_, number) =>
      buildCard(number, language),
    ),
    latestTip: {
      ...buildCard(1, language),
      achievement:
        language === "es"
          ? "Aprende a dejar el balón alto y cerca de la red."
          : "Learn to leave the ball high and close to the net.",
      achievementLanguage: language,
    },
    hasNextPage: true,
  };
}

const NOTHING_FOUND = {
  total: 0,
  tips: [],
  latestTip: null,
  hasNextPage: false,
} as const;

function buildFilteredListing(language: Language): TipsListing {
  const tips = [1, 7].map((number) => ({
    ...buildCard(number, language),
    fundamental: "reception" as const,
    level: "basic" as const,
  }));
  return {
    ...buildSampleListing(language),
    query: { fundamental: "reception", level: "basic", query: "", page: 1 },
    total: tips.length,
    tips,
    latestTip: null,
    hasNextPage: false,
  };
}

function buildStateListing(
  state: string,
  language: Language,
): TipsListing | undefined {
  const sample = buildSampleListing(language);
  switch (state) {
    case "datos":
      return sample;
    case "filtrado":
      return buildFilteredListing(language);
    case "sin-resultados":
      return {
        ...sample,
        ...NOTHING_FOUND,
        query: { level: "advanced", query: "zzz", page: 1 },
      };
    case "vacio":
      return { ...sample, ...NOTHING_FOUND, publishedTotal: 0 };
    default:
      return undefined;
  }
}

export function loader({ request }: Route.LoaderArgs): {
  readonly listing: TipsListing;
  readonly language: Language;
} {
  const language = getRequestLanguage(request);
  const state = new URL(request.url).searchParams.get(STATE_PARAM) ?? "datos";
  const listing = buildStateListing(state, language);
  if (serverEnv.appEnv === "production" || listing === undefined) {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  return { listing, language };
}

export default function DevTips({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return <TipsPage {...loaderData} />;
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Tips · VolleyTip (muestra)" },
    { name: "robots", content: "noindex" },
  ];
}
