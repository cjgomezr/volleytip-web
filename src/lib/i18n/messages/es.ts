// El español es la fuente de los tipos de las claves (decisión 1 del PRD de
// W2). `as const` conserva cada texto literal para que el compilador pueda
// leer sus variables `{nombre}`.
import { errorsEs } from "./errors";

export const es = {
  "home.title": "VolleyTip",
  "home.description":
    "Tips de voleibol en 60 segundos, tienda y camps de VolleyTip.",
  "home.eyebrow": "Videos cortos · educativos · gratis",
  "home.headingStart": "Aprende voley en",
  "home.headingHighlight": "60",
  "home.headingEnd": "segundos",
  "home.intro":
    "Técnica, táctica y entrenamiento para jugadores y entrenadores de todos los niveles.",
  "home.hero.cta": "Ver los tips",
  "home.hero.opensInNewTab": "(se abre en otra pestaña)",
  "home.stats.label": "VolleyTip en cifras",
  "home.about.eyebrow": "Quiénes somos",
  "home.about.title": "El voley es para todos",
  "home.about.text":
    "Empezamos en 2019 con una idea: llevar el voleibol colombiano a la pantalla de todos.",
  "home.about.link": "Conoce al equipo",
  "home.about.photoAlt":
    "Camilo, fundador de VolleyTip, sentado en su estudio de grabación",
  "header.skipLink": "Saltar al contenido",
  "header.homeLink": "VolleyTip, ir al inicio",
  "header.menuLabel": "Menú principal",
  "header.menu.tips": "Tips",
  "header.menu.camps": "Camps",
  "header.menu.vballTour": "VBall Tour",
  "header.menu.shop": "Tienda",
  "header.menu.app": "App",
  "header.menu.about": "Nosotros",
  "footer.taglineStart": "¡Sigamos",
  "footer.taglineAccent": "jugando!",
  "footer.navLabel": "Enlaces del sitio",
  "footer.column.explore": "Explora",
  "footer.column.volleytip": "VolleyTip",
  "footer.column.legal": "Legal",
  "footer.link.contact": "Contacto",
  "footer.link.faq": "Preguntas frecuentes",
  "footer.link.myPurchases": "Mis compras",
  "footer.link.terms": "Términos",
  "footer.link.privacy": "Privacidad",
  "footer.social.label": "Redes sociales",
  "footer.social.tiktok": "TikTok",
  "footer.social.instagram": "Instagram",
  "footer.social.youtube": "YouTube",
  "footer.social.facebook": "Facebook",
  "footer.social.whatsapp": "WhatsApp",
  "footer.languageLabel": "Idioma del sitio",
  "footer.legalLine": "© {year} VolleyTip. Hecho en Colombia.",
  "legal.version": "Versión {version}",
  "legal.effectiveFrom": "Rige desde el {date}",
  "legal.provisionalNotice":
    "Este es un texto provisional. El texto definitivo se publicará pronto.",
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
