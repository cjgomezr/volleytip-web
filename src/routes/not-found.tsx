import { data } from "react-router";

const NOT_FOUND_STATUS = 404;

// Ruta comodín: recibe toda dirección que no coincide con ninguna otra.
// Sin ella, React Router responde el 404 sin pasar por el middleware de la
// raíz, y esa respuesta saldría sin las cabeceras que pone el servidor
// (`X-Robots-Tag`). Lo que se ve lo pinta el `ErrorBoundary` de la raíz.

export function loader(): never {
  throw data(null, { status: NOT_FOUND_STATUS });
}

export function action(): never {
  throw data(null, { status: NOT_FOUND_STATUS });
}

// Nunca se pinta: el loader siempre lanza. Hace falta para que la ruta sea
// una página y el 404 salga con el documento, no como respuesta suelta.
export default function NotFound(): null {
  return null;
}
