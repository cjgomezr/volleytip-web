import type { IncomingMessage } from "node:http";

import morgan from "morgan";

// El enlace del correo lleva en su dirección un token que abre una sesión, y
// cargar la página no lo gasta. `react-router-serve` registra cada petición
// con `morgan`: sin esto, quien lea el registro del hosting podría canjearlo.
// Lo mismo vale para el `code` con el que se vuelve de Google, solo cuando es
// el nombre entero de un parámetro (`error_code` se queda).
// `%3F`, `%3D` y `%26` son el `?`, el `=` y el `&` de una dirección metida
// dentro de otra.
const SIGN_IN_SECRET =
  /((?:token_hash|(?<=[?&]|%3F|%26)code)(?:=|%3D))(?:(?!%26)[^&])*/gi;
const REDACTED = "[oculto]";

// Se redefine `:url`, que es global en `morgan`: vale para el registro que
// arma el servidor, que usa este mismo módulo.
morgan.token(
  "url",
  (request: IncomingMessage & { readonly originalUrl?: string }): string =>
    (request.originalUrl ?? request.url ?? "").replace(
      SIGN_IN_SECRET,
      `$1${REDACTED}`,
    ),
);
