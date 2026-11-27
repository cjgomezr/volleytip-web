// Descarga el código de una ruta sin pedir sus datos. React Router no ofrece
// cómo: `<PrefetchPageLinks>` también pide los `.data`, que en el panel corren
// la guardia y las consultas de la cáscara. Se lee su manifiesto, que es
// interno: si una versión nueva lo cambia, las pruebas sin conexión de
// `tests/admin-failure.spec.ts` fallan.

export interface ManifestRoute {
  readonly parentId?: string;
  readonly module: string;
  /** En el build de producción va en un archivo aparte. */
  readonly clientActionModule?: string;
  readonly imports?: readonly string[];
}

export interface RouteManifest {
  readonly routes: Readonly<Record<string, ManifestRoute | undefined>>;
}

type LoadModule = (url: string) => Promise<unknown>;

declare global {
  interface Window {
    __reactRouterManifest?: RouteManifest;
  }
}

// Mirar el manifiesto no cuesta nada: se mira seguido, para pedir el código
// apenas llega, y durante un minuto, porque con una red lenta tarda.
const RETRY_DELAY_MS = 100;
const MAX_ATTEMPTS = 600;

const importModule: LoadModule = (url) => import(/* @vite-ignore */ url);

function reportFailure(error: unknown): void {
  // No es un fallo de la persona ni de la pantalla: el envío vuelve a
  // intentar la descarga.
  console.warn("No se pudo precargar una ruta del panel", error);
}

/** Los archivos que React Router necesita para enviar a una ruta. */
export function listRouteCode({
  module,
  clientActionModule,
  imports = [],
}: ManifestRoute): readonly string[] {
  const action = clientActionModule === undefined ? [] : [clientActionModule];
  return [module, ...action, ...imports];
}

// Para enviar a una ruta React Router carga también la de cada layout que la
// envuelve, y la pantalla de origen puede no estar bajo los mismos.
function listRouteAndLayoutsCode(
  { routes }: RouteManifest,
  route: ManifestRoute,
): readonly string[] {
  const parent =
    route.parentId === undefined ? undefined : routes[route.parentId];
  const above =
    parent === undefined ? [] : listRouteAndLayoutsCode({ routes }, parent);
  return [...new Set([...listRouteCode(route), ...above])];
}

/** Pide el código de la ruta, esperando a que React Router la conozca.
 * Devuelve cómo dejar de esperar. */
export function loadRouteCode(
  routeId: string,
  load: LoadModule = importModule,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = (attemptsLeft: number): void => {
    const manifest = window.__reactRouterManifest;
    const route = manifest?.routes[routeId];
    if (manifest !== undefined && route !== undefined) {
      for (const url of listRouteAndLayoutsCode(manifest, route)) {
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
