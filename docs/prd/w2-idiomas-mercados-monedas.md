# PRD: W2 · Idiomas, mercados y monedas

**Estado:** borrador · **Fecha:** 21 de noviembre de 2026 · **Autor:** Camilo, con Claude · **Épica:** #2

Fuentes: `docs/SRD-volleytip-web-v1.4.md` (FR-004 a FR-011, FR-122, AC-001 a AC-004, US-08), `docs/plan-maestro.md` y `docs/modelo-de-datos.md` (secciones 1, 3, 4 y 6).

## 1. Problema

El sitio tiene que salir en español y en inglés, y quedar listo para portugués y para vender en otros países. Hoy la cáscara tiene los textos escritos dentro de los componentes, una sola URL por página y ninguna noción de moneda. Si las pantallas de W3 en adelante se construyen así, habrá que reescribirlas todas: el SRD prohíbe texto escrito en los componentes (FR-006).

W2 no entrega ninguna pantalla nueva. Entrega las reglas y las piezas con las que se escriben todas las demás: de dónde sale cada texto, cómo se arma una URL en cada idioma, cómo se muestra una fecha o un precio, y dónde viven los mercados y los precios.

## 2. Usuarios y contexto

- **Usuario primario:** quien construye las épicas W3 en adelante. Es la fábrica y Camilo cuando revisa. Necesitan una sola forma de poner un texto, un enlace, una fecha y un precio, y que el CI falle cuando alguien se la salta.
- **Usuario final:** quien visita el sitio. Una persona de Colombia lo ve en español. Una de fuera (US-08) lo quiere en inglés y quiere entender en qué moneda se le cobra.
- **Hoy lo resuelve así:** no lo resuelve. La home provisional y las páginas de error tienen el texto escrito a mano, solo en español.

## 3. Objetivo y métricas de éxito

- **Objetivo:** que ninguna pantalla posterior pueda quedar con texto sin traducir, con un enlace que pierda el idioma o con un precio mal formateado, sin que el CI lo detenga.
- **Métricas:**
  - El CI falla ante un texto visible escrito en un componente y ante una clave sin traducción en inglés (AC-002).
  - Toda página responde en `/` y en `/en/` con `lang`, `hreflang` y dirección canónica correctos.
  - Cero textos escritos a mano en `src/`, fuera de la página de muestra.
  - Agregar un idioma es una lista en código, un archivo de traducción y una fila en la base. No toca ninguna pantalla.

## 4. Alcance

**Incluido:**

- Rutas sin prefijo para español y bajo `/en/` para inglés, con `lang`, `hreflang` y dirección canónica.
- Archivos de traducción con claves tipadas, y la función que las lee en el servidor y en el navegador.
- La guardia del CI contra texto sin traducir.
- Enlaces que conservan el idioma y selector de idioma que conserva la página.
- Propuesta del idioma del navegador en la primera visita, y la cookie que recuerda la elección.
- Formato de fechas, números y dinero por idioma.
- Tablas `languages`, `markets`, `site_texts`, `catalog_items` y `prices`, con sus políticas y sus lectores de servidor.
- Respaldo en español cuando falta una traducción de contenido.
- Precio aproximado en dólares con tasa manual.
- Pasar a traducciones los textos que hoy están escritos a mano: la home provisional y las páginas de error.

**Explícitamente fuera (por ahora):**

- El header, el menú y el pie, donde vive el selector de idioma a la vista (W3, #3). W2 entrega el componente; W3 lo coloca.
- Las pantallas del admin para editar idiomas, mercados, textos y la tasa del dólar (FR-065, W10a, #5). En W2 esos datos llegan por migración.
- Correos y tiquetes en el idioma del comprador (FR-008, W11a, #6). W2 deja las piezas que los correos van a usar.
- Guardar en el pedido el mercado, la moneda, el idioma y los precios del momento de la compra (FR-011, AC-004). Lo hace W6b (#11), que crea `orders`. W2 solo deja los precios como filas propias, para que un pedido pueda copiarlos.
- El selector "Envío a" del checkout (W6b) y las zonas de envío (`shipping_zones`, W5, #9).
- Productos, tips y camps. W2 crea `catalog_items` y `prices` vacías.
- Conversión automática de precios (FR-010, fase 3), portugués y cobro en otras monedas.
- Detección de país. El SRD la descarta (FR-122).

## 5. Requerimientos funcionales

### RF-1 · Idiomas soportados y rutas por idioma · Must

Los idiomas que el sitio sirve están en una sola lista en el código. El español se sirve sin prefijo y cada otro idioma bajo el suyo. Toda página conoce su idioma desde el servidor (FR-004).

- **Dado** una página que existe, **cuando** se pide sin prefijo, **entonces** responde en español con `<html lang="es">`.
- **Dado** la misma página, **cuando** se pide bajo `/en/`, **entonces** responde en inglés con `<html lang="en">`.
- **Dado** una dirección que empieza por `/es/`, **cuando** se pide, **entonces** redirige de forma permanente a la misma dirección sin prefijo. El español tiene una sola dirección.
- **Dado** un prefijo que no es un idioma soportado, como `/fr/`, **cuando** se pide, **entonces** responde 404 con la página de error en español.
- **Dado** una ruta nueva declarada una sola vez, **entonces** existe en todos los idiomas soportados sin repetir su declaración.
- **Dado** `/healthz` y las rutas de `/dev/`, **entonces** no tienen versión por idioma.
- **Dado** un tercer idioma agregado a la lista con su archivo de traducción, **entonces** todas las páginas existen bajo su prefijo sin tocar ninguna pantalla.

### RF-2 · Archivos de traducción y lectura de textos · Must

Todo texto fijo vive en un archivo por idioma. Una sola función lo entrega, en el servidor y en el navegador (FR-006).

- **Dado** una clave que existe, **cuando** se pide en un idioma, **entonces** se obtiene el texto de ese idioma.
- **Dado** una clave que no existe, **cuando** se usa en el código, **entonces** no compila.
- **Dado** un texto con una variable, como un nombre o una cantidad, **cuando** se pide con sus valores, **entonces** los incluye. **Dado** que falta un valor, **entonces** no compila.
- **Dado** un texto que cambia con la cantidad ("1 cupo", "3 cupos"), **cuando** se pide, **entonces** usa la forma que corresponde al idioma.
- **Dado** un valor que viene de una persona, **cuando** se inserta en un texto, **entonces** se pinta como texto y nunca como HTML.
- **Dado** una página, **entonces** su título y su descripción salen de las traducciones (NFR-008).
- **Dado** el navegador, **entonces** solo recibe los textos del idioma de la página, no los de todos.
- **Dado** código de servidor sin una petición delante, como un correo, **cuando** pide un texto para un idioma, **entonces** lo obtiene igual.

### RF-3 · Guardia contra texto sin traducir · Must

El CI falla cuando un texto visible queda escrito en un componente o cuando a un idioma le falta una clave (AC-002).

- **Dado** un componente con un texto visible escrito a mano, **cuando** corre el lint, **entonces** falla y nombra el archivo y la línea.
- **Dado** un atributo que una persona lee o escucha (`alt`, `aria-label`, `title`, `placeholder`) escrito a mano, **entonces** el lint también falla.
- **Dado** una clave presente en español y ausente en inglés, o al revés, **cuando** corren las pruebas, **entonces** fallan y nombran la clave.
- **Dado** una clave cuyo texto está vacío en algún idioma, **entonces** las pruebas fallan.
- **Dado** una clave con variables, **cuando** un idioma usa variables distintas a las del español, **entonces** las pruebas fallan.
- **Dado** una clave que ningún archivo usa, **entonces** las pruebas fallan y la nombran.
- **Dado** la página de muestra y las rutas de `/dev/`, **entonces** quedan fuera de la guardia: sus textos son datos de prueba.
- **Dado** los archivos de prueba, **entonces** quedan fuera de la guardia.

### RF-4 · Enlaces, dirección canónica y selector de idioma · Must

Un enlace interno nunca pierde el idioma, y cada página declara sus versiones en los demás idiomas (FR-004, FR-005).

- **Dado** una página en inglés, **cuando** se pinta un enlace interno, **entonces** apunta a la versión en inglés. No se arma la dirección a mano.
- **Dado** una página cualquiera, **entonces** su `<head>` lleva un `hreflang` por cada idioma soportado, otro `x-default` que apunta al español, y una dirección canónica.
- **Dado** esas direcciones, **entonces** son absolutas, con `https` y con el dominio público del entorno. Salen de una variable de entorno, no de la petición.
- **Dado** una página con parámetros de búsqueda, **entonces** la dirección canónica y los `hreflang` no los llevan.
- **Dado** el selector de idioma en una página, **cuando** se elige otro idioma, **entonces** se abre la misma página en ese idioma y se conservan los parámetros de búsqueda.
- **Dado** el selector, **entonces** es un enlace por idioma, funciona sin JavaScript y marca el idioma actual para lectores de pantalla.
- **Dado** el nombre de cada idioma en el selector, **entonces** está escrito en ese idioma ("Español", "English").

### RF-5 · Propuesta de idioma y elección recordada · Must

En la primera visita el sitio propone el idioma del navegador. La elección manual se recuerda (FR-005, AC-001).

- **Dado** un navegador en inglés sin elección guardada, **cuando** entra a una página en español, **entonces** ve un aviso que le propone verla en inglés. La página no redirige sola.
- **Dado** ese aviso, **cuando** acepta, **entonces** se abre la misma página en inglés y la elección queda guardada.
- **Dado** ese aviso, **cuando** lo cierra o elige quedarse, **entonces** se guarda español y el aviso no vuelve a salir.
- **Dado** una elección guardada, **cuando** entra a la raíz del sitio sin prefijo, **entonces** se le lleva a su idioma. **Dado** que entra a una dirección con prefijo, **entonces** se respeta la dirección y no se redirige.
- **Dado** una persona que cambia de idioma con el selector, **entonces** la elección guardada se actualiza.
- **Dado** un navegador cuyo idioma no está soportado, **entonces** no hay aviso.
- **Dado** un navegador cuyo idioma coincide con el de la página, **entonces** no hay aviso.
- **Dado** un buscador o un robot, **entonces** no recibe aviso ni redirección: ve cada dirección en su idioma.
- **Dado** el aviso, **entonces** se puede cerrar con el teclado, se anuncia a lectores de pantalla y no tapa el contenido.

### RF-6 · Formato de fechas, números y dinero · Must

Fechas, números y precios se muestran según el idioma de la página, con una sola función para cada cosa (FR-008).

- **Dado** un monto en pesos colombianos, **cuando** se muestra en español, **entonces** sale como `$120.000`, sin decimales.
- **Dado** el mismo monto en una página en inglés, **entonces** sale con el formato del inglés y deja claro que son pesos colombianos.
- **Dado** un monto, **entonces** siempre viaja como un entero en la unidad menor más su moneda. No hay función que reciba un decimal.
- **Dado** una moneda que el sitio no conoce, **cuando** se pide formatear, **entonces** falla con un error claro.
- **Dado** una fecha, **cuando** se muestra, **entonces** usa el idioma de la página y la hora de Colombia, sin depender de la zona del servidor.
- **Dado** una fecha pintada en el servidor, **cuando** el navegador la retoma, **entonces** muestra lo mismo. No hay diferencia entre servidor y navegador.

### RF-7 · Idiomas y mercados en la base · Must

Tablas `languages` y `markets` según `docs/modelo-de-datos.md`. Colombia es el único mercado activo (FR-004, FR-009).

- **Dado** la base recién migrada, **entonces** `languages` tiene español (por defecto) e inglés, los dos activos.
- **Dado** la base recién migrada, **entonces** `markets` tiene una fila: Colombia, COP, idioma por defecto español, envío de productos físicos, activo.
- **Dado** `languages`, **entonces** solo puede haber un idioma por defecto.
- **Dado** `markets`, **entonces** la moneda es un código ISO de tres letras en mayúsculas y el país uno de dos.
- **Dado** un visitante anónimo, **cuando** consulta, **entonces** lee los idiomas y los mercados activos. **Dado** uno inactivo, **entonces** no lo ve.
- **Dado** un visitante anónimo o un comprador, **cuando** intenta escribir, **entonces** la base lo rechaza. Solo escribe un admin.
- **Dado** la lista de idiomas del código y la tabla `languages`, **cuando** no coinciden, **entonces** una prueba de integración falla.
- **Dado** el servidor, **entonces** tiene una función que devuelve los mercados activos, tipada.

### RF-8 · Textos editables y respaldo en español · Must

Tabla `site_texts` para textos que se editan sin código. Todo contenido traducible muestra el español cuando falta su traducción (FR-007, AC-003).

- **Dado** un texto editable con versión en inglés, **cuando** se pide en inglés, **entonces** sale en inglés.
- **Dado** un texto editable sin versión en inglés, **cuando** se pide en inglés, **entonces** sale el español.
- **Dado** una versión en inglés vacía o de solo espacios, **entonces** cuenta como ausente y sale el español.
- **Dado** una clave que no existe en ningún idioma, **cuando** se pide, **entonces** falla con un error que la nombra. No se pinta un hueco en silencio.
- **Dado** un registro con tabla de traducciones y varios campos, **cuando** en inglés falta solo uno, **entonces** ese campo sale en español y los demás en inglés. El respaldo es campo por campo.
- **Dado** `site_texts`, **entonces** su idioma tiene que existir en `languages`, y una clave no se repite en el mismo idioma.
- **Dado** un visitante anónimo, **entonces** lee los textos. Solo escribe un admin.

### RF-9 · Catálogo base y precios por mercado · Must

Tablas `catalog_items` y `prices`, con los tipos `item_kind` y `price_mode` (FR-010). Quedan vacías: las llenan W5, W8 y W14.

- **Dado** un precio, **entonces** se guarda como entero en la unidad menor con su moneda, mayor o igual a cero.
- **Dado** un ítem y un mercado, **entonces** hay como mucho un precio.
- **Dado** un precio, **entonces** su moneda es la del mercado. La base rechaza un precio en dólares para el mercado Colombia.
- **Dado** un ítem publicado con precio en el mercado, **cuando** el servidor pide su precio, **entonces** obtiene monto y moneda.
- **Dado** un ítem sin precio en ese mercado, **cuando** el servidor pide su precio, **entonces** obtiene "sin precio" de forma explícita. Nunca un cero.
- **Dado** un visitante anónimo, **entonces** lee solo los ítems publicados y sus precios. No ve borradores ni retirados.
- **Dado** un visitante anónimo o un comprador, **cuando** intenta escribir, **entonces** la base lo rechaza.
- **Dado** el modo de precio, **entonces** solo existe `manual`.

### RF-10 · Precio aproximado en dólares · Must

Debajo de un precio en pesos se puede mostrar un aproximado en dólares, calculado con una tasa que el admin escribe (FR-122).

- **Dado** una tasa guardada y un precio en pesos, **cuando** se pinta el aproximado, **entonces** sale como "≈ US$12" con la nota de que el cobro es en pesos colombianos.
- **Dado** el aproximado, **entonces** se redondea al dólar entero. Por debajo de un dólar se muestra "menos de US$1".
- **Dado** que no hay tasa guardada, o es cero o negativa, **entonces** el aproximado no se muestra y el precio en pesos sale igual.
- **Dado** una tasa guardada con una forma que no es un número, **entonces** el servidor falla de forma visible. No se ignora.
- **Dado** un precio que no está en pesos, **entonces** no hay aproximado.
- **Dado** el aproximado, **entonces** su texto sale de las traducciones y un lector de pantalla lo lee como una frase completa.

## 6. Casos borde y estados de error

- **Barra final y mayúsculas:** `/en` y `/en/` son la misma página. `/EN/` no es un idioma: 404.
- **Página que no existe en inglés:** el 404 sale en inglés si la dirección empieza por `/en/`.
- **Cookie con un idioma que ya no se soporta, o con basura:** se ignora y se trata como primera visita.
- **Cabecera `Accept-Language` ausente, enorme o mal formada:** no hay aviso. Nunca un error.
- **Varias preferencias en `Accept-Language`:** gana la primera que el sitio soporta. `en-US` y `en-GB` cuentan como `en`.
- **Aviso de idioma y caché:** la respuesta que depende de la cookie o de `Accept-Language` no puede quedar guardada para otra persona. Las páginas que varían lo declaran.
- **JavaScript desactivado:** el selector y el aviso funcionan, porque son enlaces y un formulario.
- **Texto en inglés mucho más largo o más corto que en español:** los componentes de W1 ya soportan el triple de largo. Cada pantalla nueva se revisa en los dos idiomas.
- **Clave usada solo en un idioma por error de quien traduce:** la detecta RF-3.
- **Texto editable con HTML:** `site_texts` guarda texto plano. Si alguna pantalla necesita formato, lo decide su épica.
- **Dos admins editan el mismo texto a la vez:** gana el último. La bitácora registra los dos cambios. La pantalla es de W10a.
- **Mercado inactivo con precios:** los precios siguen guardados, pero el sitio no los lee.
- **Único mercado activo desactivado por error:** el sitio no puede mostrar ningún precio. El lector de mercados falla de forma visible en vez de devolver una lista vacía a la tienda. Impedirlo desde la pantalla es de W10a.
- **Montos enormes:** un `integer` de Postgres llega a unos 21 millones de pesos guardados en centavos. Ver la decisión 4.
- **Tasa del dólar desactualizada:** el aproximado queda viejo. Se acepta: por eso dice "aproximado" y aclara la moneda del cobro.
- **Fecha en el cambio de día:** un camp del 15 de enero a las 8 p. m. en Colombia se muestra como 15 de enero, aunque en el servidor ya sea 16.
- **Concurrencia en las migraciones:** un solo carril. Los tres tickets con migración van uno tras otro.

## 7. UX / UI

- **Mockups:** W2 no tiene pantalla propia. El selector de idioma se ve en el header de `docs/mockups/Main.png` y en el menú de `docs/mockups/HomeMovil.png`; lo coloca W3.
- **Aviso de idioma:** sin mockup: aplica `design-system.md`. Una franja sobria en la parte de arriba, con el texto en el idioma propuesto, un botón para cambiar y otro para quedarse.
- **Precio aproximado:** se ve en `docs/mockups/Digital.png`. W2 construye el componente y lo muestra en la página de muestra; W14 lo usa.
- **Flujo principal:** una persona con el navegador en inglés entra a `volleytip.com`, ve el aviso, acepta, queda en `/en/` y desde ahí todos los enlaces siguen en inglés.
- **Viewports a soportar:** 360, 390, 768 y 1440 px.

## 8. Requerimientos no funcionales

- **Seguridad:** RLS activado en las cinco tablas, con comentario de ámbito (lo exige la guardia de W1). Los valores que vienen de una persona nunca se insertan como HTML en un texto.
- **Privacidad:** la cookie de idioma es funcional y no identifica a nadie. No requiere aviso de cookies (NFR-005).
- **SEO:** `lang`, `hreflang`, dirección canónica, título y descripción por idioma (NFR-008). Ninguna redirección automática por idioma para robots.
- **Rendimiento:** el navegador recibe solo los textos de un idioma. Los lectores de idiomas y mercados no agregan una consulta a cada página que no los necesita.
- **Accesibilidad:** WCAG 2.2 AA. axe sin violaciones con el aviso y el selector en la página de muestra.
- **Portabilidad:** nada exclusivo de Railway (NFR-011). El dominio público llega por una variable con nombre propio.
- **Dependencias nuevas de ejecución:** ninguna prevista. Ver la decisión 1.

## 9. Decisiones y preguntas abiertas

Ninguna impide aprobar el PRD. Cada una trae la propuesta con la que se escribirán los tickets si no dices otra cosa.

- [ ] **1. Librería de traducciones.** Propuesta: una capa propia y pequeña (archivos por idioma, claves tipadas, variables y plurales con `Intl`), sin dependencia nueva. Son dos idiomas con textos cortos, y así el tipo de cada clave lo revisa el compilador. La alternativa es `i18next`, que trae más funciones de las que hacen falta y un paquete más en el navegador. (Camilo)
- [ ] **2. Proponer el idioma, sin redirigir.** FR-005 dice "propondrá". Propuesta: un aviso, y nunca una redirección automática en la primera visita. Una redirección por idioma del navegador confunde a los buscadores y a quien comparte un enlace. La única redirección es la de la raíz, y solo cuando ya hay una elección guardada. (Camilo)
- [ ] **3. Direcciones traducidas.** Propuesta: los nombres de sección se traducen (`/tienda` y `/en/shop`, `/nosotros` y `/en/about`), definidos en un solo mapa de rutas. Los identificadores de contenido (un tip, un producto) tienen uno solo para todos los idiomas, como dice el modelo de datos. La alternativa, dejar `/en/tienda`, es más simple pero deja direcciones en español a quien lee en inglés, y cambiarlo después cuesta porque los buscadores ya las guardaron. (Camilo)
- [ ] **4. Los pesos se guardan en centavos.** DR-001 pide la unidad menor de la moneda y Wompi cobra en centavos. Propuesta: `$120.000` se guarda como `12000000` y se muestra sin decimales. Consecuencia: un `integer` de Postgres tope en unos 21 millones de pesos. Los montos de `prices` y de todo lo que venga después usan `bigint`, y `docs/modelo-de-datos.md` se corrige en el mismo ticket. (Camilo)
- [ ] **5. Qué idiomas sirve el sitio lo decide el código.** Las traducciones son archivos del repo, así que activar un idioma siempre pide un despliegue. Propuesta: la lista vive en el código y la tabla `languages` es el catálogo que usan las tablas de traducciones y el admin. Una prueba impide que se desalineen. (Se decide al construir, salvo objeción)
- [ ] **6. Variable nueva `SITE_ORIGIN`.** Las direcciones canónicas y los `hreflang` tienen que ser absolutas y con `https`, y detrás de Railway el servidor ve las peticiones por `http`. Propuesta: una variable por entorno con el dominio público (`https://staging.volleytip.com`). Camilo la pone en Railway antes del merge del ticket que la estrena. No resuelve las cookies de sesión del admin, que siguen pendientes para W10a. (Camilo)
- [ ] **7. Cookie de idioma.** Propuesta: nombre `vt_locale`, un año, `SameSite=Lax`, `Secure` fuera de local. (Se decide al construir)

## 10. Descomposición en tickets (para write-ticket)

Los 10 tickets cuelgan de la épica #2. A diferencia de W1, casi todos se pueden trabajar con la fábrica: solo el ticket 4 necesita que Camilo ponga una variable en Railway.

Carril de migraciones: los tickets 7, 8 y 9 van uno tras otro, nunca en paralelo.

| #   | Título propuesto                                                                               | RF    | Tamaño | Depende de | Acompañado                       | Auto-merge sugerido                                              |
| --- | ---------------------------------------------------------------------------------------------- | ----- | ------ | ---------- | -------------------------------- | ---------------------------------------------------------------- |
| 1   | Servir cada página en español sin prefijo y en inglés bajo `/en/`                              | RF-1  | M      | ninguna    | No                               | No: cambia cómo se declaran todas las rutas                      |
| 2   | Leer los textos de archivos de traducción con claves tipadas                                   | RF-2  | M      | 1          | No                               | No: es la base de todos los textos del sitio                     |
| 3   | Hacer fallar el CI ante un texto escrito en un componente o una clave sin traducir             | RF-3  | M      | 2          | No                               | No: es la guardia de textos de todas las épicas                  |
| 4   | Construir los enlaces que conservan el idioma, la dirección canónica, `hreflang` y el selector | RF-4  | M      | 2          | **Sí**: `SITE_ORIGIN` en Railway | No: variable nueva; sin ella el servidor no arranca              |
| 5   | Proponer el idioma del navegador en la primera visita y recordar la elección                   | RF-5  | M      | 4          | No                               | No: lógica nueva con cookies y redirección                       |
| 6   | Formatear fechas, números y dinero según el idioma                                             | RF-6  | S      | 1          | No                               | Sí: funciones puras cubiertas por pruebas, sin datos ni permisos |
| 7   | Crear `languages` y `markets` con Colombia como único mercado activo                           | RF-7  | M      | 1          | No                               | No: permisos (RLS)                                               |
| 8   | Crear `site_texts` y el respaldo en español del contenido traducible                           | RF-8  | M      | 7          | No                               | No: permisos (RLS)                                               |
| 9   | Crear `catalog_items` y `prices` con el lector de precio por mercado                           | RF-9  | M      | 6, 8       | No                               | No: permisos (RLS) y dinero                                      |
| 10  | Mostrar el precio aproximado en dólares con la tasa manual                                     | RF-10 | S      | 2, 6       | No                               | No: lógica de dinero nueva                                       |

Orden sugerido: 1 primero. Después dos carriles: textos (2, 3, 4, 5) y base de datos (7, 8, 9). El 6 entra en cualquier momento después del 1, y el 10 cierra.

Sugerencia de `ui-review`: tickets 4, 5 y 10. Son los únicos con algo que se ve: el selector de idioma, el aviso de idioma y el precio aproximado.

Lo que W2 deja sin cerrar a propósito: AC-004 (el pedido conserva el precio del momento de la compra) se comprueba en W6b, y FR-008 para correos en W11a.

Skill que falta: sigue sin existir `supabase-practices` con las reglas de migraciones y RLS de este repo. Con los cuatro ejemplos de W1 ya hay de dónde escribirla, y los tickets 7, 8 y 9 la usarían.
