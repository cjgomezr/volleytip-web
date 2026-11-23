import type { Language } from "../languages";

// Los textos de las páginas de error, en todos los idiomas y en un archivo
// aparte. Los demás textos llegan al navegador con los datos de la raíz, y
// solo los del idioma de la página. Estos no pueden depender de eso: la
// página de error tiene que poder pintarse también cuando el fallo ocurrió
// antes de que la raíz tuviera sus datos. Por eso viajan siempre, y son los
// únicos que lo hacen.
export const errorsEs = {
  "error.notFoundTitle": "Balón fuera",
  "error.notFoundDetails": "Esta página no existe o se movió.",
  "error.serverTitle": "Pedimos tiempo",
  "error.serverDetails":
    "Algo falló de nuestro lado y ya quedó registrado. Intenta de nuevo en un momento.",
  "error.serverReference": "Código de referencia",
  "error.serverRetry": "Reintentar",
  "error.genericTitle": "No pudimos mostrar esta página",
  "error.genericDetails":
    "La solicitud no se pudo completar. Vuelve al inicio e intenta de nuevo.",
  "error.homeLink": "Ir al inicio",
  "error.homeShort": "Inicio",
  "error.homeLinkLabel": "VolleyTip, ir al inicio",
  // El título completo, para la pestaña del navegador. En la página va en
  // dos renglones: `titleStart` y `titleAccent`.
  "maintenance.title": "Estamos calentando",
  "maintenance.titleStart": "Estamos",
  "maintenance.titleAccent": "calentando",
  "maintenance.badge": "Volvemos pronto",
  "maintenance.details":
    "Estamos mejorando la página. Mientras tanto, los tips siguen en redes.",
  // Sin punto final: la hora en español termina en "p. m." o "a. m.", que ya
  // lo trae.
  "maintenance.returnsAt": "Volvemos el {time}",
  "maintenance.socialLabel": "Mientras tanto, síguenos",
  "maintenance.logoLabel": "VolleyTip",
} as const;

export type ErrorMessages = {
  readonly [Key in keyof typeof errorsEs]: string;
};

export const errorsEn = {
  "error.notFoundTitle": "Out of bounds",
  "error.notFoundDetails": "This page does not exist or it moved.",
  "error.serverTitle": "Timeout called",
  "error.serverDetails":
    "Something broke on our side and it has been logged. Please try again in a moment.",
  "error.serverReference": "Reference code",
  "error.serverRetry": "Try again",
  "error.genericTitle": "We could not show this page",
  "error.genericDetails":
    "The request could not be completed. Go back to the home page and try again.",
  "error.homeLink": "Go to the home page",
  "error.homeShort": "Home",
  "error.homeLinkLabel": "VolleyTip, go home",
  "maintenance.title": "We are warming up",
  "maintenance.titleStart": "We are",
  "maintenance.titleAccent": "warming up",
  "maintenance.badge": "Back soon",
  "maintenance.details":
    "We are improving the site. Meanwhile, the tips keep coming on social media.",
  "maintenance.returnsAt": "We will be back on {time}.",
  "maintenance.socialLabel": "Meanwhile, follow us",
  "maintenance.logoLabel": "VolleyTip",
} as const satisfies ErrorMessages;

export const ERROR_MESSAGES: Readonly<Record<Language, ErrorMessages>> = {
  es: errorsEs,
  en: errorsEn,
};
