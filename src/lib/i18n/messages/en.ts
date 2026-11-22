import type { Messages } from "../translate";

import { errorsEn } from "./errors";

export const en = {
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
  "header.skipLink": "Skip to content",
  "header.homeLink": "VolleyTip, go home",
  "header.menuLabel": "Main menu",
  "header.menu.tips": "Tips",
  "header.menu.camps": "Camps",
  "header.menu.vballTour": "VBall Tour",
  "header.menu.shop": "Shop",
  "header.menu.app": "App",
  "header.menu.about": "About",
  "languageSwitcher.label": "Language",
  "languageSuggestion.label": "Language suggestion",
  "languageSuggestion.message": "This page is also available in English.",
  "languageSuggestion.accept": "View in English",
  "languageSuggestion.stay": "Stay on this page",
  "priceApproximation.about": "≈ US${amount}",
  "priceApproximation.lessThanOne": "less than US$1",
  "priceApproximation.spoken": {
    one: "approximately {count} dollar",
    other: "approximately {count} dollars",
  },
  "priceApproximation.spokenLessThanOne": "less than 1 dollar",
  "priceApproximation.chargeNote": "You are charged in Colombian pesos.",
  ...errorsEn,
} as const satisfies Messages;
