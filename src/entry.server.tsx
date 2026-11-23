import { PassThrough } from "node:stream";

import type {
  EntryContext,
  HandleDataRequestFunction,
  HandleErrorFunction,
} from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";

import { ReferenceCodeContext } from "~/lib/error-reference";
import { applyMaintenanceHeaders } from "~/lib/maintenance-mode.server";
import {
  MAINTENANCE_STATUS,
  findMaintenanceNotice,
} from "~/lib/maintenance-notice";
import {
  findRequestReferenceCode,
  reportServerError,
  sendFailedNavigationToDocument,
} from "~/lib/server-error-report.server";

export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> | Response {
  // El 503 del modo mantenimiento lo lanza el middleware de la raíz; sus
  // cabeceras se ponen aquí porque una respuesta lanzada no lleva las suyas.
  const errors = routerContext.staticHandlerContext.errors;
  if (findMaintenanceNotice(errors?.root) !== undefined) {
    applyMaintenanceHeaders(responseHeaders);
  }

  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => abort(),
      streamTimeout + 1000,
    );

    const { pipe, abort } = renderToPipeableStream(
      <ReferenceCodeContext.Provider
        value={() => findRequestReferenceCode(request)}
      >
        <ServerRouter context={routerContext} url={request.url} />
      </ReferenceCodeContext.Provider>,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              // Clear the timeout to prevent retaining the closure and memory leak
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          pipe(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            reportServerError(error, request);
          }
        },
      },
    );
  });
}

// Todo error que React Router captura en el servidor pasa por aquí, con el
// código de referencia que luego muestra la página 500.
export const handleError: HandleErrorFunction = (error, { request }) => {
  reportServerError(error, request);
};

// Las peticiones de datos de una navegación sin recargar. Si una falló, el
// navegador carga el documento para que la página 500 lleve su código.
export const handleDataRequest: HandleDataRequestFunction = (
  response,
  { request },
) => {
  // Con el mantenimiento encendido todo dato pedido responde 503; lleva las
  // mismas cabeceras que el documento.
  if (response.status === MAINTENANCE_STATUS) {
    applyMaintenanceHeaders(response.headers);
  }
  return sendFailedNavigationToDocument(response, request);
};
