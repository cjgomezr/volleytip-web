import type { IncomingMessage } from "node:http";

import morgan from "morgan";

// El enlace del correo lleva en su dirección un token que abre una sesión, y
// cargar la página no lo gasta. `react-router-serve` registra cada petición
// con `morgan`: sin esto, quien lea el registro del hosting podría canjearlo.
const SIGN_IN_TOKEN = /(token_hash=)[^&]*/gi;
const REDACTED = "[oculto]";

// Se redefine `:url`, que es global en `morgan`: vale para el registro que
// arma el servidor, que usa este mismo módulo.
morgan.token(
  "url",
  (request: IncomingMessage & { readonly originalUrl?: string }): string =>
    (request.originalUrl ?? request.url ?? "").replace(
      SIGN_IN_TOKEN,
      `$1${REDACTED}`,
    ),
);
