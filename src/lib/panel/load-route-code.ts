// Descarga el código de una ruta sin pedir sus datos. React Router no ofrece
// cómo: `<PrefetchPageLinks>` también pide los `.data`, que en el panel corren
// la guardia y las consultas de la cáscara. Se lee su manifiesto, que es
// interno: si una versión nueva lo cambia, las pruebas sin conexión de
// `tests/admin-failure.spec.ts` fallan.

export interface RouteManifest {
  readonly routes: Readonly<
    Record<
      string,
      | { readonly module: string; readonly imports?: readonly string[] }
      | undefined
    >
  >;
}

type LoadModule = (url: string) => Promise<unknown>;

declare global {
  interface Window {
    __reactRouterManifest?: RouteManifest;
  }
}

const RETRY_DELAY_MS = 250;
const MAX_ATTEMPTS = 20;

const importModule: LoadModule = (url) => import(/* @vite-ignore */ url);

function reportFailure(error: unknown): void {
  // No es un fallo de la persona ni de la pantalla: el envío vuelve a
  // intentar la descarga.
  console.warn("No se pudo precargar una ruta del panel", error);
}

/** Pide el código de la ruta, esperando a que React Router la conozca.
 * Devuelve cómo dejar de esperar. */
export function loadRouteCode(
  routeId: string,
  load: LoadModule = importModule,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = (attemptsLeft: number): void => {
    const route = window.__reactRouterManifest?.routes[routeId];
    if (route !== undefined) {
      for (const url of [route.module, ...(route.imports ?? [])]) {
        load(url).catch(reportFailure);
      }
      return;
    }
    if (attemptsLeft > 1) {
      timer = setTimeout(() => attempt(attemptsLeft - 1), RETRY_DELAY_MS);
    }
  };
  attempt(MAX_ATTEMPTS);
  return () => clearTimeout(timer);
}
