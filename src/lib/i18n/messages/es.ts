// El español es la fuente de los tipos de las claves (decisión 1 del PRD de
// W2). `as const` conserva cada texto literal para que el compilador pueda
// leer sus variables `{nombre}`.
import { errorsEs } from "./errors";

export const es = {
  "site.name": "VolleyTip",
  "home.title": "VolleyTip",
  "home.description":
    "Tips de voleibol en 60 segundos, tienda y camps de VolleyTip.",
  "home.eyebrow": "Sitio en construcción",
  "home.headingStart": "Aprende voley en",
  "home.headingHighlight": "60",
  "home.headingEnd": "segundos",
  "home.intro":
    "Estamos reconstruyendo volleytip.com. Esta página es la base del sitio nuevo.",
  "home.healthLink": "Ver estado del servicio",
  "languageSwitcher.label": "Idioma",
  "languageSuggestion.label": "Sugerencia de idioma",
  "languageSuggestion.message":
    "Esta página también está disponible en español.",
  "languageSuggestion.accept": "Ver en español",
  "languageSuggestion.stay": "Quedarme en esta página",
  "priceApproximation.about": "≈ US${amount}",
  "priceApproximation.lessThanOne": "menos de US$1",
  "priceApproximation.spoken": {
    one: "aproximadamente {count} dólar",
    other: "aproximadamente {count} dólares",
  },
  "priceApproximation.spokenLessThanOne": "menos de 1 dólar",
  "priceApproximation.chargeNote": "El cobro es en pesos colombianos.",
  ...errorsEs,
} as const;
