import type { Messages } from "../translate";

import { errorsEn } from "./errors";

export const en = {
  "site.name": "VolleyTip",
  "home.title": "VolleyTip",
  "home.description":
    "Volleyball tips in 60 seconds, plus the VolleyTip shop and camps.",
  "home.eyebrow": "Site under construction",
  "home.headingStart": "Learn volleyball in",
  "home.headingHighlight": "60",
  "home.headingEnd": "seconds",
  "home.intro":
    "We are rebuilding volleytip.com. This page is the foundation of the new site.",
  "home.healthLink": "Check service status",
  "languageSwitcher.label": "Language",
  "languageSuggestion.label": "Language suggestion",
  "languageSuggestion.message": "This page is also available in English.",
  "languageSuggestion.accept": "View in English",
  "languageSuggestion.stay": "Stay on this page",
  ...errorsEn,
} as const satisfies Messages;
