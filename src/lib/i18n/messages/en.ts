import type { Messages } from "../translate";

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
  "error.notFoundTitle": "404",
  "error.notFoundDetails": "This page does not exist.",
  "error.genericTitle": "Error",
  "error.genericDetails": "Something went wrong. Please try again.",
} as const satisfies Messages;
