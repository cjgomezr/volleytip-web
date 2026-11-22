# PRD: W3 · Navegación, home y páginas de apoyo

**Estado:** aprobado · **Fecha:** 22 de noviembre de 2026 · **Autor:** Camilo, con Claude · **Épica:** #3

Fuentes: `docs/SRD-volleytip-web-v1.4.md` (FR-001 a FR-003, FR-012, FR-052 a FR-057, FR-080 a FR-082, FR-137; AC-021 a AC-023, AC-027, AC-028, AC-035, AC-065), `docs/plan-maestro.md`, `docs/modelo-de-datos.md` (secciones 1 y 11) y los mockups `Main`, `HomeMovil`, `Nosotros`, `Contacto`, `App` y `Errores`.

## 1. Problema

El sitio nuevo tiene una sola página, y es provisional. No hay header, ni pie, ni forma de llegar de una página a otra. Tampoco existe ninguna de las páginas que dicen quién es VolleyTip y cómo escribirle: nosotros, contacto, la app, preguntas frecuentes y las legales.

Sin esta épica no hay dónde colgar lo demás. Tips (W4), el VBall Tour (W15) y la tienda (W5) necesitan un menú que las enlace, un pie y una página de error que funcione. Y la bandeja de mensajes del admin (W10a) espera la tabla que crea el formulario de contacto.

## 2. Usuarios y contexto

- **Visitante:** llega casi siempre desde TikTok o Instagram, en celular. Quiere saber qué es VolleyTip, ver tips y, si tiene una duda, escribir. Una parte lee en inglés.
- **Andrés y Camilo:** cambian el aviso de la barra, las cifras y las preguntas frecuentes sin pedir un despliegue. Las pantallas para hacerlo son de W10a; aquí queda el dato y el sitio lo lee.
- **Quien construye las épicas siguientes:** necesita una cáscara común (barra, header, pie) y una regla clara para agregar su página al menú.
- **Hoy lo resuelve así:** la web vieja en DigitalOcean. El sitio nuevo no lo resuelve.

## 3. Objetivo y métricas de éxito

- **Objetivo:** que el sitio nuevo se pueda recorrer de punta a punta en los dos idiomas, y que una persona pueda escribirle a VolleyTip y apuntarse a la lista de la app.
- **Métricas:**
  - Toda página pública lleva la misma barra, el mismo header y el mismo pie, en `/` y en `/en/`.
  - Ningún enlace del menú, del pie o de la home lleva a una página que no existe.
  - Un mensaje de contacto válido queda guardado y uno de bot no (AC-027, AC-063).
  - Encender el mantenimiento toma un cambio en la base y menos de un minuto, sin desplegar (AC-028).
  - axe sin violaciones en todas las páginas nuevas, a 360, 390, 768 y 1440 px.

## 4. Alcance

**Incluido:**

- La cáscara del sitio: barra de anuncios, header con menú único, menú de celular a pantalla completa y pie.
- Home con héroe, cifras, invitación "Avísame" y bloque de nosotros.
- Nosotros, contacto, página de la app y preguntas frecuentes.
- Términos y Privacidad, con su versión, y la pieza que guarda qué versión aceptó cada persona.
- Páginas de error 404 y 500, y modo mantenimiento.
- Ruta `/r/<código>` reservada y archivos `.well-known`.
- Tablas `messages`, `waitlists`, `faqs` y `faq_translations`, con sus políticas y sus funciones.

**Explícitamente fuera (por ahora):**

- Los bloques de la home que dependen de otras épicas: último video y fundamentos con conteo (W4, #4), eventos (W8, #14, y W15, #7) y productos destacados (W5, #9). Cada épica agrega su bloque. Ver la decisión 1.
- Las entradas del menú cuyas páginas no existen: Tips, Camps, VBall Tour, Tienda, "Mis compras" y carrito. Cada épica agrega la suya.
- La página de pago rechazado (FR-056). Necesita un pedido; se propone pasarla a W6b (#11). Ver la decisión 3.
- Las páginas de Envíos y de Cambios y devoluciones (FR-057). Dependen de datos de la tienda que aún no existen (P-02, P-04). Las agrega W5 con la misma pieza de páginas legales. Ver la decisión 4.
- Las pantallas del admin: editar la barra, las cifras y las preguntas frecuentes, y la bandeja de mensajes (W10a, #5).
- El correo que avisa al equipo de un mensaje nuevo y el de confirmación a quien escribe (W11a, #6).
- El aviso de lanzamiento a la lista de espera, y la rutina compartida de FR-055 (cuando exista la app).
- El `sitemap.xml` (NFR-008). El plan maestro no lo asigna a ninguna épica; se propone para W13 (#8), cuando ya existan todas las páginas de L1.
- El buscador de tips en la 404. Aparece cuando exista el listado de tips (W4).

## 5. Requerimientos funcionales

### RF-1 · Cáscara común y header · Must

Todas las páginas públicas comparten una ruta de layout con la barra, el header y el pie. El header lleva el logo, el menú y el selector de idioma (FR-002).

- **Dado** cualquier página del mapa de páginas, **cuando** se pinta, **entonces** lleva la barra, el header y el pie, sin que la página los declare.
- **Dado** `/healthz`, las rutas de `/dev/` y los archivos `.well-known`, **entonces** no llevan la cáscara.
- **Dado** el header, **entonces** el logo enlaza a la home del idioma actual y tiene nombre accesible.
- **Dado** la lista del menú en el código, **entonces** conserva el orden de FR-002 (Tips, Camps, VBall Tour, Tienda, App, Nosotros) y es la misma en todas las páginas.
- **Dado** una entrada del menú cuya página no está en el mapa de páginas, **entonces** no se pinta. No hay enlaces muertos.
- **Dado** la página actual, **entonces** su entrada del menú se marca a la vista y con `aria-current="page"`.
- **Dado** el header en 768 px o más, **entonces** muestra el menú en línea y el selector de idioma de W2.
- **Dado** un enlace "Saltar al contenido", **cuando** se navega con teclado, **entonces** es el primer elemento que recibe foco.

### RF-2 · Menú de celular a pantalla completa · Must

Por debajo de 768 px el menú se abre desde un botón y ocupa toda la pantalla (FR-002, AC-022).

- **Dado** una pantalla de 360 px, **cuando** se abre el menú, **entonces** ocupa toda la pantalla y la página de atrás no se desplaza.
- **Dado** el menú abierto, **entonces** cada opción mide al menos 48 px de alto y su letra es de 30 px.
- **Dado** el menú abierto, **cuando** se pulsa el botón de cerrar o la tecla Escape, **entonces** se cierra y el foco vuelve al botón que lo abrió.
- **Dado** el menú abierto, **entonces** el foco no sale de él con Tab, y un lector de pantalla lo anuncia como diálogo.
- **Dado** el menú abierto, **cuando** se elige una opción, **entonces** se abre la página y el menú queda cerrado.
- **Dado** el pie del menú, **entonces** muestra el idioma y las redes. La línea de "Mis compras" aparece cuando exista esa página (W14).
- **Dado** JavaScript desactivado, **entonces** las opciones del menú siguen al alcance: el botón lleva a los enlaces del pie.

### RF-3 · Pie · Must

El pie lleva redes, enlaces, idioma y línea legal (FR-003).

- **Dado** el pie, **entonces** muestra los íconos oficiales de TikTok, Instagram, YouTube, Facebook y WhatsApp, cada uno con nombre accesible.
- **Dado** el ícono de WhatsApp, **entonces** abre una conversación con +57 314 648 6275.
- **Dado** un enlace a una red, **entonces** abre en otra pestaña con `rel="noopener noreferrer"`.
- **Dado** las direcciones de las redes, **entonces** viven en un solo archivo, que usan el pie, el menú de celular, la home y la página de mantenimiento.
- **Dado** el pie, **entonces** enlaza a Nosotros, Contacto, App, Preguntas frecuentes, Términos y Privacidad. Las demás entradas ("Mis compras", Tips, Tienda, Envíos y cambios) aparecen cuando exista su página.
- **Dado** el pie, **entonces** incluye el selector de idioma con los nombres completos ("Español", "English").
- **Dado** la línea legal, **entonces** muestra el año en curso, calculado en el servidor con la hora de Colombia.

### RF-4 · Barra de anuncios editable · Must

La barra muestra hasta tres mensajes que se cambian sin desplegar (FR-001, AC-021).

- **Dado** el ajuste `announcement_bar` con mensajes, **cuando** se pinta una página, **entonces** la barra los muestra en el idioma de la página.
- **Dado** un mensaje sin versión en inglés, **cuando** se pinta en `/en/`, **entonces** sale en español.
- **Dado** que el ajuste no existe o no tiene mensajes, **entonces** la barra no se pinta y no deja un hueco.
- **Dado** un ajuste con una forma inválida, **entonces** la barra no se pinta, la página responde igual y el error queda en el registro del servidor. Un aviso mal escrito no puede tumbar el sitio.
- **Dado** un cambio del ajuste en la base, **entonces** el texto nuevo aparece en todas las páginas en menos de un minuto.
- **Dado** más de tres mensajes guardados, **entonces** se muestran los tres primeros.
- **Dado** un celular, **entonces** la barra muestra solo el primer mensaje.
- **Dado** un mensaje, **entonces** se pinta como texto, nunca como HTML.

AC-021 completo (el admin guarda y se ve) se comprueba cuando W10a tenga el editor. En W3 el cambio se hace en la base.

### RF-5 · Home · Must

La home deja de ser provisional (FR-012, AC-023).

- **Dado** la home, **entonces** muestra el héroe "Aprende voley en 60 segundos" con los íconos de las redes.
- **Dado** el héroe, **entonces** el botón "Ver los tips" aparece cuando exista el listado de tips (W4). Hasta entonces el botón principal lleva a TikTok.
- **Dado** las cifras, **entonces** son cuatro, cada una con su valor y su leyenda, y salen de `site_texts`. Cambiarlas no pide un despliegue.
- **Dado** una cifra sin leyenda en inglés, **entonces** en `/en/` sale la leyenda en español.
- **Dado** que no hay camps próximos, **entonces** la home muestra la invitación "Avísame" (AC-023). En W3 siempre es así, porque los camps no existen todavía. W8 cambia la condición.
- **Dado** el bloque de nosotros, **entonces** muestra la foto, un texto corto y un enlace a Nosotros.
- **Dado** la home, **entonces** tiene título y descripción propios en cada idioma.
- **Dado** la foto del bloque de nosotros, **entonces** lleva `alt`, ancho y alto, y carga perezosa.

### RF-6 · Invitación "Avísame" · Must

Un formulario corto para enterarse del próximo camp. Guarda en `waitlists` con el tipo `camp_notify`.

- **Dado** un correo válido, **cuando** se envía, **entonces** queda guardado con su idioma y su ciudad (opcional), y la pantalla confirma.
- **Dado** un correo que ya estaba en esa lista, **cuando** se envía otra vez, **entonces** la pantalla confirma igual y no se crea una segunda fila.
- **Dado** un correo con mayúsculas o espacios, **entonces** se guarda normalizado.
- **Dado** el formulario, **entonces** pasa por las cinco capas de FR-135 de W1.
- **Dado** un correo inválido, **entonces** el error aparece junto al campo y lo escrito se conserva.
- **Dado** el formulario, **entonces** dice que al enviar se acepta la política de privacidad, con su enlace, y se guarda la versión aceptada.

### RF-7 · Nosotros · Must

Página con la historia y las personas (FR-052).

- **Dado** la página, **entonces** muestra el héroe con foto, las mismas cuatro cifras de la home, "Cómo lo hacemos" en tres pasos, la historia en cuatro momentos, los dos fundadores y "Trabajemos juntos".
- **Dado** las cifras, **entonces** salen del mismo sitio que las de la home. No hay dos copias.
- **Dado** el bloque de personajes, **entonces** se muestra con la imagen y la frase "¡Sigamos jugando!". El párrafo que los describe queda pendiente de P-07 y no se pinta un texto de relleno.
- **Dado** "Trabajemos juntos", **entonces** el botón lleva a Contacto con el motivo "Marcas" ya elegido. El botón "Media kit" no se pinta mientras no exista el archivo.
- **Dado** cada foto, **entonces** lleva `alt` descriptivo, ancho y alto.

### RF-8 · Mensajes de contacto en la base · Must

Tabla `messages` con el tipo `message_status`, y una función de Postgres que guarda un mensaje.

- **Dado** un mensaje válido, **cuando** el servidor llama a la función, **entonces** queda una fila con motivo, nombre, correo, país, idioma, los campos propios del motivo y estado `new`.
- **Dado** un motivo que no está en la lista (`order`, `camps`, `brands`, `suggest_tip`, `vball_tour`, `other`), **entonces** la base lo rechaza.
- **Dado** un visitante anónimo o un comprador, **cuando** intenta leer o escribir la tabla directamente, **entonces** la base lo rechaza. Solo se inserta por la función del servidor y solo lee un admin.
- **Dado** el correo, **entonces** se guarda normalizado (DR-008).
- **Dado** un mensaje, **entonces** guarda la versión de la política de privacidad vigente al enviarlo.
- **Dado** la tabla, **entonces** tiene RLS activado y comentario de ámbito, como exige la guardia de W1.

### RF-9 · Página de contacto · Must

Formulario por motivo, con los otros canales al lado (FR-053, AC-027).

- **Dado** la página, **entonces** ofrece cinco motivos: un pedido, camps y VBall Tour, marcas y colaboraciones, sugerir un tip y otro.
- **Dado** el motivo "Un pedido", **entonces** el formulario pide número de pedido (AC-027). **Dado** "Marcas y colaboraciones", **entonces** pide marca o club. Los demás motivos no agregan campos.
- **Dado** un motivo elegido, **entonces** queda en la dirección (`?motivo=pedido`), se conserva al recargar y funciona sin JavaScript.
- **Dado** un motivo desconocido en la dirección, **entonces** se usa "Otro".
- **Dado** todos los motivos, **entonces** piden nombre, correo, país y mensaje. El mensaje admite hasta 2.000 caracteres.
- **Dado** un envío válido, **entonces** se guarda, la pantalla confirma y promete respuesta en menos de 24 horas.
- **Dado** un envío con un campo inválido, **entonces** responde 400, marca cada error junto a su campo y conserva lo escrito.
- **Dado** el sexto envío en 10 minutos desde la misma IP, **entonces** se rechaza con un mensaje que ofrece WhatsApp y el correo (AC-027, AC-063).
- **Dado** un envío sin verificación de Turnstile, con el campo trampa lleno o hecho en menos de 3 segundos, **entonces** no se guarda (AC-063).
- **Dado** la columna lateral, **entonces** muestra WhatsApp, `team@volleytip.com` y hasta tres preguntas frecuentes publicadas con enlace a la página de preguntas.
- **Dado** que no hay preguntas publicadas, **entonces** ese bloque no se pinta.
- **Dado** el pie del formulario, **entonces** dice que al enviar se acepta la política de privacidad, con su enlace.

### RF-10 · Lista de espera en la base · Must

Tabla `waitlists` y una función de Postgres que inscribe un correo (FR-082).

- **Dado** un correo, un tipo (`app` o `camp_notify`), un idioma, un país y una ciudad opcional, **cuando** el servidor llama a la función, **entonces** queda una fila.
- **Dado** un correo ya inscrito en ese tipo, **entonces** la función no falla ni duplica: responde igual que con uno nuevo.
- **Dado** dos inscripciones del mismo correo a la vez, **entonces** queda una sola fila.
- **Dado** el mismo correo en los dos tipos, **entonces** hay dos filas, una por tipo.
- **Dado** un visitante anónimo o un comprador, **cuando** intenta leer o escribir la tabla directamente, **entonces** la base lo rechaza.
- **Dado** el país, **entonces** es un código de dos letras en mayúsculas.
- **Dado** una inscripción, **entonces** guarda la versión de la política de privacidad vigente.

### RF-11 · Página de la app · Must

Presenta la app gratuita, con dos estados (FR-054, FR-082).

- **Dado** el estado "lista de espera", **entonces** la página muestra "Próximamente" y un formulario con correo y país.
- **Dado** un envío válido, **entonces** se inscribe con el tipo `app`, el idioma de la página y el país elegido, y la pantalla confirma.
- **Dado** un correo ya inscrito, **entonces** la pantalla confirma igual. No revela que ya estaba.
- **Dado** el estado "disponible", **entonces** el formulario se reemplaza por los botones oficiales de App Store y Google Play, con las direcciones guardadas.
- **Dado** el estado, **entonces** sale del ajuste `app_availability`. Sin ajuste, es "lista de espera".
- **Dado** el estado "disponible" sin dirección de una tienda, **entonces** ese botón no se pinta.
- **Dado** la página, **entonces** muestra las ocho funciones, con "Pronto" en las dos que no salen en la primera versión, el bloque "Una sola cuenta", "100% gratis" y cuatro preguntas propias de la app.
- **Dado** el formulario, **entonces** pasa por las cinco capas de FR-135.
- **Dado** el contador "[N] personas ya están en la lista" del mockup, **entonces** no se construye. Ver la decisión 6.

### RF-12 · Preguntas frecuentes · Must

Tablas `faqs` y `faq_translations`, y la página que las muestra (FR-137, AC-065).

- **Dado** preguntas publicadas, **cuando** se abre la página, **entonces** aparecen en el orden de `sort_order`.
- **Dado** una pregunta en borrador o retirada, **entonces** no aparece, y un visitante anónimo no la puede leer de la base.
- **Dado** una pregunta publicada solo en español, **cuando** se ve en `/en/`, **entonces** sale en español (AC-065).
- **Dado** una pregunta con la pregunta en inglés y la respuesta solo en español, **entonces** cada campo usa su propio respaldo.
- **Dado** que no hay preguntas publicadas, **entonces** la página lo dice y ofrece el enlace a Contacto.
- **Dado** cada pregunta, **entonces** se abre y se cierra con teclado y funciona sin JavaScript.
- **Dado** una respuesta, **entonces** es texto plano con saltos de línea. No admite HTML.
- **Dado** un visitante anónimo o un comprador, **cuando** intenta escribir, **entonces** la base lo rechaza.
- **Dado** la base recién migrada, **entonces** las tablas quedan vacías. Ver la decisión 7.

### RF-13 · Páginas legales y versión aceptada · Must

Términos y Privacidad en los dos idiomas, con una versión que se guarda en cada consentimiento (FR-057).

- **Dado** `/terminos` y `/privacidad`, y sus versiones en inglés, **entonces** muestran el texto, su versión y la fecha desde la que rige.
- **Dado** el texto de cada documento, **entonces** vive en archivos del repo, uno por idioma. Cambiarlo es un commit, y así queda quién lo cambió y cuándo.
- **Dado** un documento, **entonces** su versión está declarada en un solo lugar del código, y una función devuelve la vigente.
- **Dado** un documento sin su archivo en inglés, **entonces** las pruebas fallan. Un texto legal no usa respaldo.
- **Dado** un formulario que pide aceptar un documento, **entonces** guarda la versión vigente junto al envío. Lo usan `messages` y `waitlists` aquí, y los pedidos e inscripciones después.
- **Dado** que el texto de un documento cambia sin que cambie su versión, **entonces** una prueba falla.
- **Dado** los textos del abogado pendientes (P-15), **entonces** las páginas salen con un texto provisional, marcado como tal, y con `noindex`. Ver la decisión 4.

### RF-14 · Páginas de error 404 y 500 · Must

Las páginas de error toman el diseño de `Errores.png` (FR-056, AC-028).

- **Dado** una dirección inexistente, **entonces** responde 404 con "Balón fuera", enlaces a la home y a las secciones que existan, en el idioma de la dirección.
- **Dado** la 404, **entonces** lleva la cáscara del sitio y `noindex`.
- **Dado** un error del servidor, **entonces** responde 500 con "Pedimos tiempo", un botón para reintentar, otro a la home y un código de referencia.
- **Dado** ese código, **entonces** es el mismo que queda en el registro del servidor, para poder buscar el error.
- **Dado** la 500, **entonces** no muestra detalles técnicos ni la traza.
- **Dado** que falla la lectura de la barra o del modo mantenimiento, **entonces** la 500 se pinta igual: no depende de la base.

### RF-15 · Modo mantenimiento · Must

Se enciende con un ajuste, sin desplegar (FR-056, FR-074, AC-028).

- **Dado** `maintenance_mode` encendido, **cuando** se pide cualquier página pública, **entonces** responde 503 con la página de mantenimiento, en el idioma de la dirección.
- **Dado** el modo encendido, **entonces** `/admin` y lo que cuelgue de él, `/healthz` y los archivos `.well-known` responden normal.
- **Dado** el modo encendido, **cuando** llega el envío de un formulario público, **entonces** responde 503 y no se guarda.
- **Dado** el ajuste con una hora estimada de regreso, **entonces** la página la muestra con la hora de Colombia. Sin hora, la frase no se pinta.
- **Dado** la respuesta 503, **entonces** lleva `Retry-After`, `noindex` y no se guarda en caché.
- **Dado** que el ajuste se apaga, **entonces** el sitio vuelve en menos de un minuto.
- **Dado** que la base no responde al leer el ajuste, **entonces** el sitio se sirve normal. Una base caída no enciende el mantenimiento por error.
- **Dado** la página de mantenimiento, **entonces** enlaza a Instagram, TikTok y YouTube, y no lleva el header ni el pie.

### RF-16 · Ruta `/r/` reservada y archivos de enlaces de app · Must

Lo que la app va a necesitar cuando exista (FR-080, FR-081, AC-035).

- **Dado** `/r/abc123`, **entonces** responde 200 con una página "Próximamente" y el formulario de la lista de espera de la app (AC-035).
- **Dado** `/r/` con cualquier código, **entonces** la página es la misma, lleva `noindex` y no muestra el código.
- **Dado** `/r/` sin código o con un código de más de 64 caracteres, **entonces** responde 404.
- **Dado** `/en/r/abc123`, **entonces** la página sale en inglés.
- **Dado** `/.well-known/assetlinks.json` sin ajuste guardado, **entonces** responde 200, `Content-Type: application/json` y `[]` (AC-035).
- **Dado** `/.well-known/apple-app-site-association` sin ajuste, **entonces** responde 200, JSON, con `{"applinks":{"details":[]}}`.
- **Dado** el ajuste `app_links` con los identificadores, **entonces** los dos archivos los devuelven sin desplegar.
- **Dado** un ajuste con una forma inválida, **entonces** los archivos responden el JSON vacío y el error queda en el registro.

## 6. Casos borde y estados de error

- **Página sin entrada en el menú:** la 404, las legales y `/r/` no marcan ninguna entrada como actual.
- **Texto largo en inglés:** el menú en línea no se desborda a 768 px; si no cabe, pasa al menú de celular. Cada página se revisa en los dos idiomas.
- **Mensaje de la barra muy largo:** se parte en varias líneas, no se corta ni desborda a 360 px.
- **Cifras vacías:** una cifra sin valor no se pinta. Con menos de cuatro, el bloque se acomoda; sin ninguna, no aparece.
- **Mensaje de contacto con HTML o enlaces:** se guarda como texto y el admin lo pinta como texto.
- **Mensaje enorme o campos de más:** la validación del servidor limita el largo de cada campo y descarta lo que no espera.
- **Doble clic en "Enviar":** el botón queda en estado de envío. Dos envíos válidos seguidos guardan dos mensajes; se acepta, el límite por IP corta el abuso.
- **Turnstile caído:** nadie puede enviar. El mensaje ofrece WhatsApp y el correo (decisión de W1).
- **Lista de espera y privacidad:** la respuesta es idéntica para un correo nuevo y para uno ya inscrito, en texto y en tiempo razonable.
- **Mantenimiento con alguien a mitad de un formulario:** al enviar ve la página de mantenimiento y pierde lo escrito. Se acepta: el modo se usa pocas veces y de madrugada.
- **Mantenimiento y robots:** el 503 con `Retry-After` le dice al buscador que vuelva; no borra las páginas del índice.
- **Lectura de ajustes en cada petición:** la barra y el mantenimiento se leen juntos, en una sola consulta por petición.
- **Dos admins cambian la barra a la vez:** gana el último. La pantalla y la bitácora son de W10a.
- **`/r/` con caracteres raros:** solo letras, números, guion y guion bajo. Lo demás, 404.
- **Concurrencia en las migraciones:** un solo carril, compartido con W10a si corre en paralelo. Los tickets con migración van uno tras otro.

## 7. UX / UI

- **Mockups:** `docs/mockups/Main.png` y `HomeMovil.png` (cáscara y home), `Nosotros.png`, `Contacto.png`, `App--lista-de-espera.png`, `App--disponible.png` y `Errores.png`.
- **Sin mockup:** preguntas frecuentes (P-23), páginas legales, y la versión de celular de Nosotros, Contacto y App (P-25). Se construyen desde el mockup de computador y `design-system.md`.
- **Donde manda el SRD y no el mockup:** el menú es uno solo (FR-002); los mockups muestran tres variantes y les falta VBall Tour. El pie del mockup dice "Camps y VBall Tour" y "Envíos y devoluciones": se arma con las páginas que existan.
- **Flujo principal:** una persona llega a la home desde TikTok en el celular, abre el menú, entra a App, deja su correo y ve la confirmación.
- **Flujo de contacto:** desde el pie entra a Contacto, elige "Marcas y colaboraciones", llena el formulario y ve la promesa de respuesta en 24 horas.
- **Viewports a soportar:** 360, 390, 768 y 1440 px.

## 8. Requerimientos no funcionales

- **Seguridad:** RLS activado en las cuatro tablas. `messages` y `waitlists` no se leen ni se escriben desde el navegador: solo por funciones del servidor. Todo campo se valida en el servidor (FR-135).
- **Privacidad:** los formularios guardan la versión de la política aceptada (NFR-005). No se guarda la IP en `messages` ni en `waitlists`.
- **Accesibilidad:** WCAG 2.2 AA. Menú de celular con foco atrapado y Escape; zonas de toque de 44 px o más (48 en el menú).
- **Rendimiento:** la cáscara agrega una sola consulta por petición. Las fotos usan el componente de imágenes de W1, con tamaños por pantalla (NFR-001).
- **SEO:** título y descripción por idioma en cada página; `noindex` en 404, mantenimiento, `/r/` y las legales provisionales (NFR-008).
- **Portabilidad:** nada exclusivo de Railway (NFR-011).
- **Dependencias nuevas de ejecución:** ninguna prevista. Si las páginas legales necesitan un lector de Markdown, se justifica en su PR.

## 9. Decisiones y preguntas abiertas

Camilo aprobó las propuestas 1 a 7 y la 9 el 22 de noviembre de 2026, y ese día entregó el dato de la 8.

- [x] **1. El menú y la home solo muestran lo que existe.** FR-002 fija seis entradas, pero hoy solo existirán App y Nosotros. Propuesta: la lista completa vive en el código con su orden, y una entrada se pinta cuando su página entra al mapa de páginas. Igual con los bloques de la home. Cada épica agrega lo suyo en su propio ticket. La alternativa es una página "Próximamente" por sección, que deja enlaces a páginas vacías. (Camilo)
- [x] **2. Botón "Síguenos" del header.** Está en los mockups y no en la lista de FR-002. Propuesta: no se construye. El header queda con logo, menú e idioma, y las redes van en el héroe, el menú de celular y el pie. (Camilo)
- [x] **3. Pago rechazado pasa a W6b.** La página muestra el pedido sin pagar y el motivo del banco. Sin pedidos no hay cómo construirla ni probarla. Propuesta: sale de W3 y entra a W6b (#11); se anota en el plan maestro. (Camilo)
- [x] **4. Textos legales provisionales, y dos páginas para después.** El abogado no ha entregado los textos (P-15). Propuesta: W3 publica Términos y Privacidad con un texto provisional escrito desde el SRD, versión `borrador-1`, con un aviso visible y `noindex`. Cuando lleguen los textos, se reemplazan los archivos y sube la versión. Envíos y Cambios y devoluciones las agrega W5, cuando existan las zonas y los plazos (P-02, P-04). (Camilo)
- [x] **5. Dónde viven la barra y las cifras.** Propuesta: la barra en `settings.announcement_bar`, como una lista de hasta tres mensajes con su texto por idioma. Las cifras en `site_texts`, sembradas por migración con los valores del mockup (116K, 530K, Millones, LATAM). Las dos cosas las edita W10a. (Se decide al construir, salvo objeción)
- [x] **6. Lista de espera de la app: país a la vista y sin contador.** FR-082 pide guardar el país y el SRD descarta detectarlo. Propuesta: un selector de país junto al correo, con Colombia por defecto. El contador público del mockup no se construye: pide abrir un conteo de una tabla privada y al principio diría "3 personas". (Camilo)
- [x] **7. Preguntas frecuentes vacías al nacer.** Propuesta: la tabla nace vacía y la página muestra su estado vacío. Las preguntas las carga Andrés cuando W10a tenga el editor. Las cuatro preguntas de la página de la app son textos fijos de esa página. Si Camilo entrega una lista inicial antes, entra por migración. (Camilo)
- [x] **8. Direcciones de las redes.** Las entregó Camilo el 22 de noviembre de 2026: `https://www.tiktok.com/@volleytip`, `https://www.instagram.com/volleytip/`, `https://www.youtube.com/@volleytip` y `https://www.facebook.com/volleytip/`. WhatsApp es `https://wa.me/573146486275`.
- [x] **9. Direcciones de las páginas.** Propuesta, siguiendo la decisión 3 de W2: `/nosotros` y `/en/about`, `/contacto` y `/en/contact`, `/app` en los dos, `/preguntas-frecuentes` y `/en/faq`, `/terminos` y `/en/terms`, `/privacidad` y `/en/privacy`. (Camilo)

## 10. Descomposición en tickets (para write-ticket)

Los 16 tickets cuelgan de la épica #3. Ninguno necesita que Camilo cambie algo en Railway: W3 no estrena variables de entorno.

Carril de migraciones: los tickets 4, 7, 8, 9, 11 y 12 llevan migración (tablas nuevas, o filas sembradas en `settings` y `site_texts`) y van uno tras otro. Si W10a corre a la vez en otro computador, sus tickets con migración entran en el mismo carril.

Creados el 22 de noviembre de 2026 como #82 a #97, en el mismo orden de la tabla (el ticket 1 es el #82 y el 16 es el #97). El carril de migraciones quedó encadenado con `blocked-by`: #85, #88, #89, #90, #92 y #93. Llevan `ui-review` los #82, #83, #84, #87, #89, #91, #93, #94, #95 y #96.

| #   | Título propuesto                                                        | RF    | Tamaño | Depende de | Auto-merge sugerido                            |
| --- | ----------------------------------------------------------------------- | ----- | ------ | ---------- | ---------------------------------------------- |
| 1   | Poner la cáscara común del sitio con el header y el menú único          | RF-1  | M      | ninguna    | No: cambia la estructura de todas las rutas    |
| 2   | Abrir el menú a pantalla completa en celular                            | RF-2  | M      | 1          | No: foco, teclado y diálogo                    |
| 3   | Construir el pie con redes, enlaces, idioma y línea legal               | RF-3  | S      | 1          | No: pide aceptar capturas nuevas               |
| 4   | Mostrar en la barra de anuncios los mensajes guardados en ajustes       | RF-4  | S      | 1          | No: lectura nueva en cada petición             |
| 5   | Publicar Términos y Privacidad con su versión                           | RF-13 | M      | 1          | No: consentimiento                             |
| 6   | Rediseñar las páginas de error 404 y 500                                | RF-14 | S      | 1          | No: manejo de errores del servidor             |
| 7   | Encender el modo mantenimiento desde un ajuste                          | RF-15 | M      | 4, 6       | No: puede dejar el sitio abajo                 |
| 8   | Construir la home con héroe, cifras y bloque de nosotros                | RF-5  | M      | 1, 3       | No: siembra datos por migración                |
| 9   | Crear `waitlists` y la función que inscribe un correo                   | RF-10 | M      | 5          | No: permisos (RLS)                             |
| 10  | Agregar la invitación "Avísame" a la home                               | RF-6  | S      | 8, 9       | No: formulario público                         |
| 11  | Crear `messages` y la función que guarda un mensaje                     | RF-8  | M      | 9          | No: permisos (RLS)                             |
| 12  | Crear `faqs` y `faq_translations` con la página de preguntas frecuentes | RF-12 | M      | 11         | No: permisos (RLS)                             |
| 13  | Construir la página de contacto con el formulario por motivo            | RF-9  | M      | 11, 12     | No: formulario público                         |
| 14  | Construir la página de la app con lista de espera y estado disponible   | RF-11 | M      | 9          | No: formulario público                         |
| 15  | Construir la página Nosotros                                            | RF-7  | M      | 8          | No: pide aceptar capturas nuevas               |
| 16  | Reservar `/r/` y servir los archivos de enlaces de app                  | RF-16 | S      | 14         | No: rutas públicas nuevas con datos de ajustes |

Ningún ticket lleva auto-merge. Los que parecen mecánicos (pie, Nosotros) cambian capturas, y aceptarlas ya es una decisión de Camilo.

Orden sugerido: 1 primero. Después dos carriles. Pantallas: 2, 3, 6, 8, 15. Datos: 4, 5, 7, 9, 11, 12. Los formularios (10, 13, 14, 16) cierran, cuando su tabla ya existe.

Sugerencia de `ui-review`: tickets 1, 2, 3, 6, 8, 10, 12, 13, 14 y 15. El 7 lleva una sola pantalla y el 4 usa un componente que ya existe; con las capturas basta.

Cruce con W10a: los tickets 11 y 12 crean las tablas que esperan su bandeja de mensajes y su editor de preguntas frecuentes. Esos tickets de W10a llevarán `blocked-by` con el número que les toque aquí.

Lo que W3 deja sin cerrar a propósito: AC-021 completo se comprueba en W10a; el buscador de la 404 y los bloques de la home llegan con W4, W5, W8 y W15; la página de pago rechazado con W6b.

Skill que falta: sigue sin existir `supabase-practices`. Los tickets 9, 11 y 12 la usarían.
