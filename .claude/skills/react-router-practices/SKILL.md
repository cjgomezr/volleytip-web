---
name: react-router-practices
description: >
  Reglas de este proyecto para React Router 8 en modo framework (SSR) con
  TypeScript estricto y Tailwind 4. Úsala al escribir o revisar cualquier
  archivo de src/: rutas, loaders, actions, formularios, componentes, estilos
  o sus tests. Use when writing or reviewing code under src/ (routes, loaders,
  actions, forms, components, styles, tests).
---

# React Router 8 + Tailwind 4: prácticas de VolleyTip

Reglas que un agente puede aplicar y un revisor puede verificar leyendo el
diff. No es un tutorial. Cada regla dice cómo se comprueba.

## Antes de escribir: la versión instalada manda

React Router 8 es reciente y cambia entre versiones menores. No escribas una
API de memoria.

- La documentación de la versión instalada está en
  `node_modules/react-router/docs/`. Lee el archivo que toca antes de usar una
  API que no esté ya en `src/`. Los de uso diario:
  `start/framework/routing.md`, `route-module.md`, `data-loading.md`,
  `actions.md`, `pending-ui.md` y `how-to/route-module-type-safety.md`.
- Aplica un documento solo si su marca `[MODES: ...]` incluye `framework`.
- Middleware, sesiones y cookies dependen de la versión y de
  `react-router.config.ts`: lee `how-to/middleware.md` y
  `explanation/sessions-and-cookies.md` antes de tocarlos.

**Se verifica:** el PR no usa una API que la documentación instalada marque
como obsoleta o de otro modo.

## Estructura

- El código de la app vive en `src/` (`appDirectory: "src"`), nunca en `app/`.
  Las listas `.github/visual-paths.txt` y `.github/text-only-paths.txt`
  dependen de eso.
- Las rutas se declaran a mano en `src/routes.ts`. No se usa enrutado por
  nombre de archivo: un archivo nuevo en `src/routes/` no existe hasta que
  aparece en `routes.ts`.
- Lo que comparten varias páginas (header, pie, barra de anuncios) va en una
  ruta de layout, no copiado en cada página.
- Un test vive junto a lo que prueba: `home.tsx` y `home.test.tsx`.

**Se verifica:** toda ruta nueva tiene su línea en `src/routes.ts` y su test
al lado.

## Módulos de ruta

- Los argumentos y props se tipan con los tipos generados:
  `import type { Route } from "./+types/<ruta>"`, y de ahí
  `Route.LoaderArgs`, `Route.ActionArgs`, `Route.ComponentProps`.
- `.react-router/types` nunca se edita ni se commitea. Después de agregar una
  ruta corre `npm run typecheck`, que regenera los tipos.
- Toda función exportada declara su tipo de retorno (`ReactElement`,
  `Response`, o el tipo de los datos). El lint lo exige en `src/`.
- `meta` recibe `loaderData`. Cada página pública define título y descripción
  por idioma (NFR-008).

**Se verifica:** `npm run typecheck` y `npm run lint` en verde; ningún
`any`, ningún `as` para callar un tipo de ruta.

## Datos: loaders y actions

- Los datos de una página se cargan en su `loader`. No hay `useEffect` que
  haga `fetch` de datos de la ruta.
- Las escrituras van en un `action`. Después de un action, React Router
  revalida solo: no se recarga a mano ni se copia el resultado a un estado
  local.
- Filtros, búsqueda y paginación viven en la URL. El `loader` los lee de
  `new URL(request.url).searchParams`, y el formulario es
  `<Form method="get">` (FR-013, AC-024).
- Un registro que no existe: `throw data(..., { status: 404 })` y lo pinta el
  `ErrorBoundary`. No se devuelve `null` para que el componente adivine.
- Un error de validación: el action devuelve
  `data({ errors, values }, { status: 400 })` y la página lo pinta junto a
  cada campo.
- Mutación que cambia de página o redirige: `<Form method="post">`. Mutación
  que deja a la persona donde está (agregar al carrito, marcar camiseta
  entregada): `useFetcher`.
- Toda entrada que llega del navegador se valida en el servidor, en el
  `action` o el `loader`, aunque el formulario ya la valide. Formato y
  longitud de cada campo (FR-135).

**Se verifica:** en el diff no hay `fetch` dentro de `useEffect` para datos de
la ruta; cada `action` tiene un test del caso inválido además del válido.

## Servidor y navegador

- Lo que solo puede correr en el servidor (llaves secretas, cliente de
  Supabase con `service_role`, firma de Wompi, URLs firmadas de Bunny) vive en
  archivos `*.server.ts` o en carpetas `.server/`. Un componente nunca los
  importa: solo los loaders y los actions.
- Ninguna variable de entorno secreta se lee fuera de un módulo de servidor.
  Lo que deba llegar al navegador lo entrega un `loader`, campo por campo.
- El estado de un pago nunca cambia por lo que diga el navegador ni por la
  página de regreso: solo por el webhook verificado (FR-026).
- Precios, descuentos y envío se recalculan en el servidor. Lo que manda el
  navegador solo dice qué ítems y cuántos.
- Las operaciones con carrera (stock, cupos, tiquetes) son funciones de
  Postgres. El `action` llama a la función; no hace "leer y luego escribir"
  (ver `docs/modelo-de-datos.md`, sección 12).
- Nada exclusivo de Railway en el código (NFR-011): ni variables propias de la
  plataforma ni rutas de disco.

**Se verifica:** `grep` de `process.env` y de `service_role` solo da
resultados en módulos de servidor; `npm run build` no deja ningún secreto en
`build/client`.

## Textos e idiomas

- Ningún texto visible queda escrito en un componente: sale de los archivos de
  traducción (FR-006). La única excepción es la página provisional del
  bootstrap, que W2 reemplaza.
- Fechas, números y dinero se formatean con `Intl` según el idioma. El dinero
  es un entero en la unidad menor más su moneda (DR-001): nunca se hace
  aritmética con decimales.
- Los enlaces internos conservan el idioma de la página (`/en/...`).

**Se verifica:** la prueba de textos del CI (AC-002) pasa; no hay cadenas en
español o inglés dentro de JSX.

## Estilos

- Solo tokens de `design-system.md`, que en código son el `@theme` de
  `src/app.css`: `bg-brand-night`, `text-brand-mist`, `rounded-pill`,
  `font-display`. Un color en hexadecimal dentro de una clase
  (`bg-[#221761]`) es un defecto.
- Un token nuevo se agrega primero a `design-system.md` y después a
  `src/app.css`, en el mismo PR.
- Texto sobre `brand-red` o `brand-lime`: siempre `text-brand-night`.
- Celular primero: las clases sin prefijo son para 360 px, y `md:` y `lg:`
  agregan lo del computador.
- Todo `<img>` lleva `alt`, `width` y `height` (FR-123). Las imágenes fuera de
  pantalla llevan `loading="lazy"`.
- Todo control interactivo tiene estados hover, foco visible, activo y
  deshabilitado. Nunca `outline-none` sin un reemplazo.
- Zonas de toque de 44 px o más en celular.

**Se verifica:** `npx playwright test` (visual y axe) en verde; el diff no
tiene colores sueltos; `src/design-tokens.test.ts` sigue pasando.

## Componentes y hooks

- Un componente hace una cosa. Si necesita un comentario para separar
  secciones, son dos componentes.
- El estado que se puede calcular de los props o de `loaderData` no se guarda
  en `useState`.
- Estado de navegación y de envío: `useNavigation` y `fetcher.state`, no un
  booleano propio.
- Una lista usa como `key` el id del registro, nunca el índice.

## Tests

- Vitest para la lógica: `npm test` recoge `src/**/*.test.{ts,tsx}`.
- Un `loader` o un `action` se prueba llamándolo como función, con un
  `Request` real, y afirmando sobre la `Response` o los datos.
- Un componente se prueba por lo que muestra, no por cómo está hecho.
- Lo visual y la accesibilidad los cubre Playwright en `tests/*.spec.ts`. Una
  página nueva agrega su captura en 390 y 1440 px y su pasada de axe.
- Los tests de `tests/unit/` son del kit de la fábrica: no se tocan desde un
  ticket de producto.

**Se verifica:** cada criterio de aceptación del ticket tiene un test que lo
nombra (AC-0xx) y que falla si se quita la implementación.
