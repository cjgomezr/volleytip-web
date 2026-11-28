# PRD: W11a · Correos base

**Estado:** aprobado · **Fecha:** 28 de noviembre de 2026 · **Autor:** Camilo, con Claude · **Épica:** #6

Fuentes: `docs/SRD-volleytip-web-v1.4.md` (FR-064, FR-068, FR-069; NFR-011), `docs/plan-maestro.md`, `docs/modelo-de-datos.md` (sección 11), `docs/prd/w10a-admin-base.md` (RF-9 y decisiones 2 y 7), el mockup `docs/mockups/Correos.png` y el detalle de un mensaje en `docs/mockups/source/Admin.dc.html`. Lo que se afirma de Resend se leyó en su documentación el 28 de noviembre de 2026; cada ticket lo confirma otra vez antes de usarlo.

## 1. Problema

El sitio todavía no puede enviar un correo propio. El único que sale es el enlace de acceso al panel, que lo manda Supabase Auth con una plantilla sin marca. Nada queda registrado: si un correo no llega, nadie se entera.

La bandeja de mensajes (W10a) deja leer y cerrar, pero no responder. Andrés abre su programa de correo o WhatsApp, contesta desde ahí, y el panel no sabe qué se dijo. Si la persona vuelve a escribir, su respuesta cae en un buzón aparte y la conversación queda partida en dos sitios.

Todas las épicas que siguen necesitan enviar: el VBall Tour confirma asistencias (W15), la tienda confirma pedidos (W11b), los camps mandan tiquetes (W9). Sin una sola forma de enviar, registrar y reintentar, cada una inventaría la suya.

## 2. Usuarios y contexto

- **Andrés:** contesta mensajes, casi siempre desde el celular. Quiere responder sin salir del panel y ver ahí mismo si la persona contestó.
- **Camilo:** quiere saber si los correos están saliendo y poder reintentar uno que falló.
- **Quien escribió por el formulario de contacto:** recibe la respuesta en su correo, con la marca de VolleyTip, y contesta con "Responder" como en cualquier correo.
- **Quien construye las épicas siguientes:** necesita una función para enviar un correo con plantilla, en el idioma del destinatario, sin pensar en registro ni reintentos.
- **Hoy lo resuelven así:** "Responder por correo" abre el programa de correo de quien contesta. No queda copia en el panel.

## 3. Objetivo y métricas de éxito

- **Objetivo:** que el sitio envíe correos con la marca de VolleyTip, que cada envío quede registrado y se reintente si falla, y que una conversación con alguien que escribió se lleve completa desde el panel.
- **Métricas:**
  - Todo correo que el sitio intenta enviar tiene una fila en `email_log`, también los que fallan.
  - Un envío que falla por una causa pasajera se reintenta solo. Si agota los intentos, se ve en el panel en menos de una hora.
  - Andrés responde un mensaje desde el celular sin salir del panel.
  - La contestación de la persona aparece en la conversación en menos de dos minutos y el mensaje vuelve a contar como pendiente.
  - Repetir un aviso de Resend no duplica nada.
  - axe sin violaciones en las pantallas nuevas, a 360, 390, 768 y 1440 px.

## 4. Alcance

**Incluido:**

- Una función de servidor para enviar un correo con plantilla, en español o en inglés, que registra el envío.
- La plantilla común del mockup: logo, franja de color, contenido, un solo botón y pie con WhatsApp y redes. En HTML y en texto plano.
- El estado de entrega de cada correo (entregado, rebotado, marcado como spam), recibido de Resend.
- Reintento automático de los envíos fallidos y reintento a mano desde el panel.
- Un módulo "Correos" en el panel para ver los envíos y sus fallos.
- Responder un mensaje desde el panel, con plantillas de respuesta y adjuntos (el resto de FR-064).
- Ver en el panel lo que la persona contesta a esa respuesta.
- El correo de acceso al panel vestido con la plantilla común.
- La baja de los correos de marketing (FR-069).

**Explícitamente fuera (por ahora):**

- Las plantillas de cada épica: compra (W11b), camp y tiquete (W9), digitales (W14) y VBall Tour (W15). Aquí queda la plantilla común y la forma de agregar una.
- Enviar un correo a una lista (aviso de nuevo camp, lista de espera de la app). Llega con la épica que lo necesite. Aquí queda lista la baja.
- Escribir a alguien que no escribió primero. Toda conversación nace de un mensaje del formulario de contacto.
- Correos con formato en las respuestas del panel. La respuesta es texto con saltos de línea.
- Leer en el panel el buzón de team@volleytip.com. Solo entra lo que se contesta a una respuesta enviada desde el panel.
- Aviso al equipo (por correo o WhatsApp) cuando llega un mensaje nuevo. El resumen del panel ya lo cuenta.
- Medir aperturas y clics.

## 5. Requerimientos funcionales

### RF-1 · Enviar un correo con registro · Must

Una sola función de servidor envía por Resend desde `VolleyTip <team@volleytip.com>` y deja cada intento en `email_log` (FR-068, FR-069).

- **Dado** una plantilla, un destinatario, un idioma y los datos de la plantilla, **cuando** se pide el envío, **entonces** se crea una fila en `email_log` antes de llamar a Resend, con el estado "en cola".
- **Dado** que Resend acepta el correo, **entonces** la fila pasa a "enviado" con el identificador de Resend y la fecha.
- **Dado** que Resend rechaza el correo o no responde, **entonces** la fila guarda el error y el número de intentos, y quien llamó recibe un resultado de fallo sin que la página se caiga.
- **Dado** el mismo envío pedido dos veces con la misma llave (por ejemplo un doble clic), **entonces** sale un solo correo.
- **Dado** un destinatario con mayúsculas o espacios, **entonces** se guarda y se envía en minúsculas y sin espacios (DR-008).
- **Dado** un idioma que no está activo, **entonces** el correo sale en español.
- **Dado** el entorno local o las pruebas, **entonces** no se llama a Resend: el envío queda registrado y su contenido se puede leer para probarlo.
- **Dado** `email_log`, **entonces** nadie la lee ni la escribe desde el navegador sin sesión de admin; un admin la lee y no la edita.

### RF-2 · Plantilla común · Must

Todos los correos del sitio comparten un esqueleto (mockup `Correos.png`).

- **Dado** un correo, **entonces** lleva el logo sobre `brand-night`, una franja con el título, el contenido, como máximo un botón y el pie con WhatsApp, Instagram y TikTok.
- **Dado** la franja, **entonces** admite las variantes del mockup: lima, rojo, noche y clara. Sobre lima y rojo el texto va en `brand-night`.
- **Dado** un correo, **entonces** sale también en texto plano, con el mismo contenido y el enlace del botón escrito.
- **Dado** el pie, **entonces** sus textos salen de los archivos de traducción, en el idioma del correo.
- **Dado** un cliente de correo que no carga imágenes o no entiende estilos modernos, **entonces** el correo se lee igual: tablas, estilos en línea y texto alternativo en el logo.
- **Dado** una dirección `/dev/correos` fuera de producción, **entonces** muestra cada plantilla con datos de ejemplo, en los dos idiomas, para revisarla y capturarla.
- **Dado** una plantilla nueva de otra épica, **entonces** se agrega declarando su asunto, su contenido y sus datos, sin copiar el esqueleto.

### RF-3 · Estado de entrega · Must

El sitio recibe de Resend lo que pasó con cada correo y lo anota.

- **Dado** un aviso de Resend con firma válida, **cuando** dice entregado, rebotado, marcado como spam, retrasado o fallido, **entonces** la fila de ese correo cambia de estado y guarda cuándo.
- **Dado** un aviso sin firma, con firma inválida o con una fecha vieja, **entonces** se rechaza y no cambia nada.
- **Dado** el mismo aviso recibido dos veces, **entonces** el segundo no cambia nada (DR-005).
- **Dado** un aviso que llega fuera de orden (el "enviado" después del "entregado"), **entonces** el estado no retrocede.
- **Dado** un aviso de un correo que el sitio no conoce, **entonces** se responde bien y no se crea nada.
- **Dado** un correo rebotado o marcado como spam, **entonces** no se reintenta.

### RF-4 · Reintentos · Must

Un envío que falla por una causa pasajera se vuelve a intentar solo (FR-069).

- **Dado** un envío fallido por red, por límite de peticiones o por un error del proveedor, **entonces** se reintenta con espera creciente, hasta cinco intentos.
- **Dado** un envío fallido por una causa que no va a cambiar (dirección inválida, adjunto prohibido), **entonces** no se reintenta y queda como fallido.
- **Dado** un envío que agotó los intentos, **entonces** queda como fallido con el último error y aparece en el panel.
- **Dado** que la cuota del día se acabó, **entonces** los envíos esperan al día siguiente sin gastar intentos.
- **Dado** un reintento que corre dos veces a la vez, **entonces** sale un solo correo.
- **Dado** un correo fallido, **cuando** un admin pulsa "Reintentar", **entonces** vuelve a la cola con los intentos en cero y queda en la bitácora.

### RF-5 · Correos en el panel · Must

Un módulo "Correos" muestra lo que el sitio ha enviado (FR-069).

- **Dado** el módulo, **entonces** lista los envíos del más reciente al más antiguo, de 50 en 50, con plantilla, destinatario, estado y fecha.
- **Dado** los filtros de estado y de plantilla y la búsqueda por destinatario, **entonces** se combinan y viven en la dirección.
- **Dado** un envío, **cuando** se abre, **entonces** muestra sus intentos, el último error, el identificador de Resend y a qué se refiere (el mensaje, y más adelante el pedido o el tiquete), con enlace a ello.
- **Dado** un envío, **entonces** el panel no muestra el cuerpo del correo ni datos de la plantilla que no hagan falta para reconocerlo.
- **Dado** envíos fallidos, **entonces** el resumen del panel los cuenta en una tarjeta que abre el módulo filtrado por fallidos, y la entrada del menú muestra el número.
- **Dado** la lista vacía o un filtro sin resultados, **entonces** lo dice y ofrece quitar los filtros.

### RF-6 · Plantillas de respuesta · Must

Textos base para contestar más rápido (FR-064).

- **Dado** el panel, **entonces** un admin crea, edita, ordena y desactiva plantillas de respuesta. Cada una tiene nombre, idioma, asunto y cuerpo.
- **Dado** una plantilla con `{nombre}` en el cuerpo, **cuando** se usa en una respuesta, **entonces** se reemplaza por el nombre de quien escribió.
- **Dado** una base recién creada, **entonces** trae cuatro plantillas en español y las mismas cuatro en inglés: información de camps, estado de un pedido, propuesta de marca recibida y gracias por la sugerencia de tip.
- **Dado** una plantilla desactivada, **entonces** no se ofrece al responder y sigue en la lista.
- **Dado** un nombre, asunto o cuerpo vacío o más largo que su límite, **entonces** se rechaza con el error en el campo y conserva lo escrito.
- **Dado** crear, editar o desactivar una plantilla, **entonces** queda en la bitácora.

### RF-7 · Responder un mensaje desde el panel · Must

El detalle de un mensaje deja escribir y enviar la respuesta (FR-064).

- **Dado** el detalle de un mensaje, **entonces** ofrece un formulario con asunto (propuesto: "Re:" y el motivo) y cuerpo.
- **Dado** el selector de plantillas, **entonces** muestra las activas en el idioma del mensaje y, al elegir una, llena asunto y cuerpo. Si ya había texto escrito, pide confirmar antes de reemplazarlo.
- **Dado** una respuesta válida, **cuando** se envía, **entonces** sale con la plantilla común en el idioma del mensaje, queda guardada en la conversación con quién la escribió y cuándo, y el mensaje pasa a "respondido".
- **Dado** que el envío falla, **entonces** la respuesta queda guardada como "no enviada" con su error, el mensaje no pasa a "respondido" y la pantalla lo dice.
- **Dado** una respuesta enviada, **entonces** la conversación muestra su estado de entrega (enviado, entregado, rebotado).
- **Dado** un cuerpo vacío o de más de 5.000 caracteres, **entonces** se rechaza y conserva lo escrito.
- **Dado** un cuerpo con HTML, **entonces** llega como texto, y en el panel se pinta como texto.
- **Dado** el mismo envío pulsado dos veces, **entonces** sale una sola respuesta.
- **Dado** una respuesta enviada, **entonces** la bitácora guarda quién respondió qué mensaje y cuándo, sin el cuerpo.
- **Dado** un mensaje archivado, **entonces** se puede leer su conversación, y para responder hay que reabrirlo.
- **Dado** "Escribir por WhatsApp", **entonces** sigue disponible como hoy. El enlace que abría el programa de correo desaparece.

### RF-8 · Adjuntos en la respuesta · Must

Una respuesta puede llevar archivos (FR-064).

- **Dado** el formulario de respuesta, **entonces** admite hasta 5 archivos PDF, JPG, PNG o WebP, con un total de 10 MB.
- **Dado** un archivo de otro tipo, uno que se pasa del límite o un sexto archivo, **entonces** se rechaza diciendo cuál y por qué, y conserva el texto y los demás archivos.
- **Dado** el tipo de un archivo, **entonces** el servidor lo comprueba por su contenido, no por su nombre.
- **Dado** una respuesta con adjuntos, **entonces** el correo los lleva y la conversación los lista con nombre y tamaño.
- **Dado** un adjunto guardado, **entonces** solo un admin con sesión lo descarga, con un enlace que vence. No tiene dirección pública.
- **Dado** una respuesta cuyo envío falló, **entonces** el reintento conserva sus adjuntos.

### RF-9 · Recibir las contestaciones en el panel · Should

Lo que la persona contesta a una respuesta del panel entra a la misma conversación.

- **Dado** una respuesta enviada desde el panel, **entonces** su dirección de respuesta es única para ese mensaje y está en un subdominio que recibe Resend, no en el buzón de team@volleytip.com.
- **Dado** una contestación a esa dirección, **cuando** Resend avisa con firma válida, **entonces** el sitio trae el correo, guarda su texto en la conversación y devuelve el mensaje a "nuevo", de modo que vuelve a contar en el resumen.
- **Dado** una contestación con el texto citado del correo anterior, **entonces** el panel muestra lo nuevo y deja ver el resto.
- **Dado** una contestación con HTML, **entonces** se guarda y se muestra como texto. Nunca se pinta su HTML.
- **Dado** una contestación con adjuntos PDF o de imagen dentro del límite, **entonces** se guardan y se listan. Los demás se nombran como "no guardado".
- **Dado** una contestación desde un correo distinto al de quien escribió, o que no pasa las comprobaciones de autenticidad del correo, **entonces** se guarda con un aviso visible.
- **Dado** un correo a una dirección que no corresponde a ningún mensaje, **entonces** se descarta y queda una línea en el registro del servidor.
- **Dado** el mismo aviso recibido dos veces, **entonces** la contestación se guarda una sola vez.
- **Dado** una contestación a un mensaje archivado, **entonces** el mensaje vuelve a "nuevo".
- **Dado** más de 20 contestaciones a un mismo mensaje en una hora, **entonces** las siguientes se descartan.
- **Dado** un entorno sin recepción configurada, **entonces** las respuestas salen con team@volleytip.com como dirección de respuesta y el panel avisa que las contestaciones llegarán a ese buzón.

### RF-10 · Correo de acceso al panel con la marca · Must

El enlace de acceso llega vestido como los demás correos (FR-068).

- **Dado** el correo del enlace de acceso, **entonces** usa el esqueleto común, con el botón "Entrar al panel" y el aviso de que el enlace vence.
- **Dado** la plantilla de Supabase Auth, **entonces** se genera desde el mismo esqueleto con un comando, para que no se desvíen. En local queda en `supabase/config.toml`; en los proyectos alojados la pega Camilo.
- **Dado** el cambio, **entonces** entrar con el enlace sigue funcionando igual: la dirección del enlace no cambia.

### RF-11 · Baja de los correos de marketing · Should

Quien recibe un correo de marketing puede dejar de recibirlos (FR-069).

- **Dado** un envío marcado como marketing, **entonces** lleva un enlace de baja en el pie y los encabezados `List-Unsubscribe` y `List-Unsubscribe-Post`.
- **Dado** ese enlace, **cuando** la persona lo abre, **entonces** ve una página que confirma la baja con un botón. La baja de un clic del cliente de correo también funciona.
- **Dado** un correo dado de baja, **cuando** el sitio intenta enviarle marketing, **entonces** no sale y la fila queda como "omitido por baja".
- **Dado** un envío transaccional (una respuesta, un pedido, un tiquete), **entonces** sale aunque el correo esté dado de baja y no lleva enlace de baja.
- **Dado** el enlace de baja, **entonces** no revela el correo en la dirección y no sirve para dar de baja a otra persona.
- **Dado** una baja repetida, **entonces** responde igual y no falla.

## 6. Casos borde y estados de error

- **Resend caído o lento:** quien envía recibe "no se pudo enviar ahora" y el correo queda en cola. La pantalla no espera más de unos segundos.
- **Cuota del plan agotada:** hoy son 100 correos al día, contando los recibidos y los enlaces de acceso que manda Supabase por la misma cuenta. Los envíos esperan y el panel lo muestra como causa.
- **Dos admins responden el mismo mensaje a la vez:** salen las dos respuestas y la conversación muestra ambas con su autor.
- **Respuesta con el correo del destinatario mal escrito:** rebota. La conversación lo muestra y el mensaje vuelve a "nuevo" para que alguien lo atienda por WhatsApp.
- **Contestación enorme:** el texto se guarda hasta 20.000 caracteres y se avisa que está cortado.
- **Contestación automática ("estoy fuera de la oficina"):** entra como cualquier otra. No se filtra.
- **Alguien adivina o reenvía la dirección de respuesta:** la dirección lleva un valor al azar de 32 bytes. Un correo de otro remitente entra con aviso; no puede leer nada.
- **Adjunto con nombre raro o larguísimo:** se guarda con un nombre limpio y se muestra el original recortado.
- **Plantilla de respuesta borrada del idioma del mensaje:** el selector sale vacío y se puede escribir a mano.
- **Mensaje sin correo válido:** no existe; el formulario de contacto lo exige.
- **Avisos de Resend para un entorno equivocado:** cada entorno tiene su secreto de firma; el aviso del otro falla la firma y se rechaza.
- **Reintento de un correo cuya plantilla cambió:** sale con la plantilla nueva y los datos guardados.
- **1.000 envíos en la lista:** paginación en el servidor e índices por fecha y estado.
- **Sesión que vence escribiendo una respuesta larga:** el aviso de envío que no llegó (W10a, #143) conserva el texto. Los archivos elegidos hay que volver a elegirlos.
- **Concurrencia en las migraciones:** los tickets con migración van uno tras otro, en el mismo carril que cualquier otra épica abierta.

## 7. UX / UI

- **Mockups:** `docs/mockups/Correos.png` (el esqueleto y sus variantes) y el detalle de un mensaje en `docs/mockups/source/Admin.dc.html` (respuesta con plantillas y adjuntos).
- **Sin mockup:** el módulo "Correos", el editor de plantillas de respuesta, la conversación con contestaciones y la página de baja. Se construyen desde `Admin.png` y `design-system.md`.
- **Donde manda este documento y no el mockup:** ninguno de los seis correos del mockup se construye aquí; son de otras épicas. El mockup no muestra contestaciones dentro del panel; aquí sí van.
- **La conversación:** en el detalle del mensaje, del más antiguo al más reciente. El mensaje original arriba, cada respuesta del equipo y cada contestación debajo, con autor, fecha y estado. El formulario de respuesta va al final.
- **Flujo principal:** Andrés abre un mensaje en el celular, elige la plantilla "Información de camps", ajusta dos frases, adjunta un PDF y envía. Al día siguiente el resumen muestra un mensaje nuevo: es la contestación, dentro de la misma conversación.
- **Flujo de Camilo:** ve en el resumen "2 correos fallidos", abre el módulo, lee el error y pulsa "Reintentar".
- **Viewports a soportar:** 360, 390, 768 y 1440 px. Los correos se revisan además a 320 px de ancho, que es lo que dejan algunos clientes de correo.

## 8. Requerimientos no funcionales

- **Seguridad:** la llave de Resend y los secretos de firma viven solo en el servidor. Todo aviso de Resend se verifica por firma antes de leerlo. El HTML de una contestación nunca se pinta. Los adjuntos se comprueban por contenido y no tienen dirección pública. Las tablas nuevas nacen con RLS y sin acceso para quien no es admin.
- **Privacidad:** `email_log` guarda los datos de la plantilla para poder reintentar; solo los lee un admin. La bitácora no guarda cuerpos de respuestas ni de contestaciones. No se guarda la IP de nadie.
- **Rendimiento:** enviar una respuesta no deja la pantalla esperando más de 5 segundos. Los listados responden en menos de un segundo con 1.000 registros (NFR-002).
- **Accesibilidad:** WCAG 2.2 AA en el panel. En los correos: contraste suficiente, texto real y no imágenes de texto, y versión en texto plano.
- **Idiomas:** ningún texto escrito en los componentes ni en las plantillas; la prueba de textos del CI los cubre (AC-002).
- **Portabilidad:** nada exclusivo de Railway (NFR-011).
- **Dependencias nuevas de ejecución:** `resend`, el cliente oficial, para enviar, verificar la firma de los avisos y traer los correos recibidos. Ver la decisión 2.
- **Variables nuevas:** la llave de Resend, el secreto de firma de los avisos, el dominio de recepción y el secreto de la tarea de reintentos. Se declaran en `.env.example`, `src/lib/env.server.ts` y `docs/entornos.md`.
- **Documentos que cambian al aprobar:** `docs/plan-maestro.md` (la épica pasa de S a M y suma tablas) y `docs/modelo-de-datos.md` (sección 11).

## 9. Decisiones y preguntas abiertas

Camilo respondió el 28 de noviembre de 2026: las contestaciones se quieren ver en el panel, las plantillas las diseña la fábrica con la marca y los adjuntos son PDF e imágenes. Lo demás quedó como estaba propuesto. Camilo aprobó el documento ese mismo día, con las demás decisiones como estaban propuestas.

- [x] **1. Los avisos de Resend y los reintentos corren en el servidor de la app.** El plan maestro dice Edge Functions para los webhooks. Propuesta: aquí no, porque las plantillas viven en el código de la app y una Edge Function tendría que duplicarlas. Los avisos entran por una ruta del sitio. Los reintentos los dispara `pg_cron` cada cinco minutos, llamando a una ruta protegida con un secreto. Si se aprueba, el plan maestro lo anota como excepción de esta épica. (Camilo)
- [x] **2. Dependencia `resend`.** Propuesta: usar el cliente oficial. La alternativa es llamar a su API a mano y reescribir la verificación de firmas. (Camilo)
- [x] **3. Plantillas en HTML propio, sin React Email.** Propuesta: una función que arma el esqueleto con tablas y estilos en línea, para no sumar otra dependencia. Se revisa si las plantillas de W11b y W9 lo vuelven difícil de mantener. (Se decide al construir, salvo objeción)
- [x] **4. Subdominio de recepción.** Propuesta: `reply.volleytip.com` en producción, con un registro MX hacia Resend. El buzón de team@volleytip.com no se toca. Agregar el registro en Namecheap y activar la recepción en Resend lo hace Camilo. (Camilo)
- [x] **5. Plan de Resend.** El plan gratis da 100 correos al día, contando recibidos, y según su página de precios un solo destino de avisos. Staging y producción necesitan cada uno el suyo. Propuesta: en staging los avisos se prueban con peticiones firmadas de prueba y solo producción recibe los reales; se pasa al plan de pago antes de L1 si el volumen lo pide. La alternativa es pagar desde ya. (Camilo)
- [x] **6. Dónde viven los adjuntos.** Propuesta: un bucket privado de Supabase Storage. Bunny Storage privado llega con W14 y los adjuntos no necesitan CDN. (Camilo)
- [x] **7. Límites.** Propuesta: 5 archivos y 10 MB por respuesta; cuerpo de 5.000 caracteres; contestaciones hasta 20.000. (Se decide al construir, salvo objeción)
- [x] **8. Una contestación reabre el mensaje.** Propuesta: vuelve a "nuevo" y cuenta en el resumen, también si estaba archivado. No se agrega un estado nuevo. (Camilo)
- [x] **9. La baja de marketing va aquí.** Ningún correo de L1 es de marketing. Propuesta: construirla de última en esta épica, porque FR-069 es de W11a y el aviso de nuevo camp (W8) la necesita lista. Si aprieta el tiempo, pasa a W11b. (Camilo)
- [x] **10. Textos de las cuatro plantillas iniciales.** La fábrica propone los textos en español e inglés y Andrés los ajusta desde el panel. (Andrés, después de construir)
- [x] **11. El WhatsApp del pie.** El mockup dice +57 314 648 6275. Confirmar que es el número de atención. (Camilo)
- [x] **12. Cuánto se guarda.** Propuesta: los datos de plantilla en `email_log` se borran a los 90 días y queda la fila con su estado; conversaciones y adjuntos se guardan como los mensajes. (Camilo)

## 10. Descomposición en tickets (para write-ticket)

Los 12 tickets cuelgan de la épica #6 y se crearon el 28 de noviembre de 2026 como #163 a #174, en el orden de la tabla. Varios crean tablas, que es área de revisión humana (RLS): ninguno lleva auto-merge. El ticket de recibir las contestaciones era tamaño L y se partió en dos: el 9 y el 10.

| #   | Issue | Título                                                         | RF    | Tamaño | Depende de | Auto-merge sugerido                                   |
| --- | ----- | -------------------------------------------------------------- | ----- | ------ | ---------- | ----------------------------------------------------- |
| 1   | #163  | Enviar un correo por Resend y dejarlo en `email_log`           | RF-1  | M      | ninguna    | No: migración con RLS y una llave secreta             |
| 2   | #164  | Armar la plantilla común de los correos y su página de muestra | RF-2  | M      | 1          | No: pide aceptar capturas nuevas                      |
| 3   | #165  | Recibir de Resend el estado de entrega de cada correo          | RF-3  | M      | 1          | No: verifica firmas y cambia estados                  |
| 4   | #166  | Reintentar solos los envíos fallidos                           | RF-4  | M      | 1          | No: tarea programada con un secreto                   |
| 5   | #167  | Mostrar los correos enviados y sus fallos en el panel          | RF-5  | M      | 1, 4       | No: lee datos personales                              |
| 6   | #168  | Administrar las plantillas de respuesta                        | RF-6  | M      | 1          | No: migración con RLS                                 |
| 7   | #169  | Responder un mensaje desde el panel                            | RF-7  | M      | 1, 2, 6    | No: envía correos a terceros con datos personales     |
| 8   | #170  | Adjuntar archivos a una respuesta                              | RF-8  | M      | 7          | No: subida de archivos y almacenamiento privado       |
| 9   | #171  | Recibir las contestaciones a una respuesta y guardarlas        | RF-9  | M      | 3, 7, 8    | No: entrada de correo externo; pide el MX de Camilo   |
| 10  | #172  | Mostrar la conversación completa con sus contestaciones        | RF-9  | M      | 9          | No: muestra datos personales                          |
| 11  | #173  | Vestir el correo de acceso al panel con la plantilla común     | RF-10 | S      | 2          | No: toca el acceso al admin; Camilo pega la plantilla |
| 12  | #174  | Dar de baja de los correos de marketing                        | RF-11 | M      | 1, 2       | No: página pública y migración con RLS                |

Carril de migraciones: las migraciones de esta épica y de W4 van en una sola fila, y cada ticket lleva un `blocked-by` al anterior de la fila además de sus dependencias de producto. El orden es: W4 1 (#151), después de esta épica el 1, 6, 3, 4, 7, 8 y 9, luego W4 11 (#161) y al final el 12.

Orden sugerido: el 1 primero y solo. Después dos carriles: envíos (2, 3, 4, 5, 11) y conversación (6, 7, 8, 9, 10). El 12 va de último. Todos llevan la etiqueta `carril:correos`.

Tickets que necesitan a Camilo: el 1 (la llave de Resend en `.env.local` y en Railway), el 3 (crear el destino de avisos en Resend y guardar su secreto), el 9 (el registro MX en Namecheap y activar la recepción) y el 11 (pegar la plantilla en los dos proyectos de Supabase).

Con `ui-review`: tickets 2, 5, 6, 7 y 10. Los demás no cambian pantallas o reutilizan lo que esos dejan.

Cruces con otras épicas:

- **W10a (#5):** el 5 y el 6 agregan cada uno una entrada al menú del panel, igual que #130. Van de a uno para no chocar en los mismos archivos. El 7 cambia el detalle de un mensaje, que construyó #125.
- **W15 (#7):** espera el 1 y el 2 para su correo de confirmación de asistencia. No necesita los demás.
- **W11b (#13) y W9 (#15):** agregan sus plantillas sobre el 2 y heredan registro, reintentos y estado de entrega.
- **W8 (#14):** su aviso de nuevo camp es marketing y usa la baja del 12.
