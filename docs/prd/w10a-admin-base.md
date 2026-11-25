# PRD: W10a · Admin base

**Estado:** aprobado · **Fecha:** 25 de noviembre de 2026 · **Autor:** Camilo, con Claude · **Épica:** #5

Fuentes: `docs/SRD-volleytip-web-v1.4.md` (FR-058, FR-059, FR-064 a FR-067, FR-079; AC-019, AC-021, AC-033, AC-065; NFR-002, NFR-003), `docs/plan-maestro.md`, `docs/modelo-de-datos.md` (secciones 4, 11 y 13) y los mockups `Admin`, `AdminLogin` y `AdminMovil`.

## 1. Problema

El sitio ya guarda cosas que nadie puede ver ni cambiar sin entrar a la base de datos. Los mensajes de contacto se acumulan en `messages`. La barra de anuncios, las cifras de la home y las preguntas frecuentes se editan con SQL. El modo mantenimiento se enciende a mano.

Tampoco existe la puerta. No hay forma de entrar a `/admin`, ni sesiones, ni una pantalla que diga quién es del equipo. Tips (W4), el VBall Tour (W15) y la tienda (W5) traen cada una su propia sección del panel, y hoy no tienen dónde colgarla.

## 2. Usuarios y contexto

- **Andrés:** publica contenido y contesta mensajes, casi siempre desde el celular. No toca código ni la base.
- **Camilo:** administra el equipo, los ajustes y revisa la bitácora. Usa computador y celular.
- **Staff de check-in con cuenta:** existe como rol desde W1. Su única pantalla, el escáner, llega con W9.
- **Quien construye las épicas siguientes:** necesita una cáscara, una guardia de acceso y una forma única de escribir en la bitácora, para agregar su sección sin rehacerlas.
- **Hoy lo resuelven así:** Camilo cambia filas en la base. Andrés no puede hacer nada.

## 3. Objetivo y métricas de éxito

- **Objetivo:** que Andrés y Camilo entren a `/admin` con su correo y manejen desde ahí todo lo que el sitio ya guarda, sin tocar la base.
- **Métricas:**
  - Un correo que no es del equipo no entra, ni con enlace ni con Google (AC-019).
  - Un comprador con sesión no lee ni escribe nada del panel (AC-033).
  - Cambiar la barra de anuncios desde el panel se ve en el sitio en menos de un minuto (AC-021).
  - Toda escritura hecha desde el panel deja una entrada en la bitácora (FR-067).
  - Los listados responden en menos de un segundo con 1.000 registros (NFR-002).
  - axe sin violaciones en todas las pantallas, a 360, 390, 768 y 1440 px.

## 4. Alcance

**Incluido:**

- Sesión del admin con Supabase Auth: entrar con enlace mágico o con Google, cerrar sesión y guardia de `/admin` por rol.
- El correo del enlace enviado por Resend, también en producción.
- El primer admin de cada entorno.
- La cáscara del panel: menú lateral en computador, barra inferior en celular y un registro de módulos para que cada épica agregue el suyo (FR-079).
- Una sola forma de ejecutar una acción del admin, que escribe en la bitácora.
- Resumen con lo que existe hoy: mensajes sin responder, listas de espera y última actividad.
- Bandeja de mensajes: leer, filtrar, marcar respondido y archivar.
- Editores de la barra de anuncios, las cifras de la home y las preguntas frecuentes.
- Idiomas, mercados y tasa de referencia del dólar.
- Ajustes: modo mantenimiento y estado de la app.
- Equipo: invitar, cambiar rol y desactivar.
- Pantalla para leer la bitácora.
- El panel en español y en inglés.

**Explícitamente fuera (por ahora):**

- El editor de tips y la subida a Bunny (FR-060). Pasa a W4 (#4), que crea las tablas de tips. Lo decidió Camilo el 25 de noviembre de 2026.
- Responder un mensaje desde el panel, con plantillas y adjuntos (el resto de FR-064). Pasa a W11a (#6), que trae Resend. Aquí la respuesta se escribe en el correo o el WhatsApp de quien contesta.
- El correo de acceso al admin vestido con la plantilla común de VolleyTip (W11a). Aquí sale con una plantilla sencilla. Ver la decisión 7.
- Ventas del mes, pedidos por enviar, inscritos del próximo camp y stock bajo en el resumen. Cada tarjeta llega con su épica: W10b, W8 y W5.
- Productos, pedidos, camps, galerías y paradas del Tour: cada sección la construye su épica.
- El buscador general del mockup. Ver la decisión 13.
- Agregar un idioma nuevo desde el panel. Un idioma necesita sus archivos de traducción, que son código.
- Precios por mercado de cada producto (W5) y conversión automática (fase 3).
- El escáner y cualquier pantalla del rol staff (W9).
- Editar los textos legales. Viven en archivos con su versión (W3).

## 5. Requerimientos funcionales

### RF-1 · Sesión del admin en el servidor · Must

El servidor conoce a quien pide una página de `/admin` por una sesión de Supabase Auth guardada en cookies. Las consultas del panel se hacen con esa sesión, de modo que las políticas RLS de admin también aplican (FR-058, FR-077).

- **Dado** una petición con una sesión válida, **cuando** llega al servidor, **entonces** el servidor obtiene el usuario verificando la sesión contra Supabase, no leyendo la cookie sin comprobarla.
- **Dado** una sesión cuyo token de acceso venció y cuyo token de refresco sigue vigente, **entonces** se renueva sin que la persona vuelva a entrar y las cookies nuevas salen en la respuesta.
- **Dado** las cookies de sesión, **entonces** son `HttpOnly`, `Secure` fuera de local y `SameSite=Lax`.
- **Dado** una consulta del panel, **entonces** usa un cliente de Supabase con la sesión de la persona. El cliente con `service_role` queda para lo que la sesión no puede hacer, y cada uso se justifica en su ticket.
- **Dado** "Cerrar sesión", **cuando** se confirma, **entonces** la sesión se invalida en Supabase, las cookies se borran y la persona queda en la pantalla de entrada.
- **Dado** el registro público de Supabase Auth, **entonces** está apagado: una cuenta solo la crea el servidor (decisión 5).

### RF-2 · Entrar con enlace mágico · Must

La pantalla de entrada pide un correo y envía un enlace de un solo uso (FR-058, AC-019).

- **Dado** el correo de un admin o staff activo, **cuando** pide el enlace, **entonces** Supabase le envía un enlace de un solo uso y la pantalla dice que revise su correo.
- **Dado** un correo que no es del equipo, que es de un comprador o que está desactivado, **cuando** pide el enlace, **entonces** no se envía nada y la pantalla responde lo mismo que en el caso anterior (AC-019). La respuesta no revela si el correo existe.
- **Dado** el enlace, **cuando** se abre, **entonces** el servidor lo canjea, crea la sesión y lleva al panel en el idioma del perfil.
- **Dado** un enlace vencido o ya usado, **entonces** la pantalla lo explica y ofrece pedir otro.
- **Dado** el formulario de entrada, **entonces** pasa por la protección común de formularios de W1 (FR-135), con su propio límite por IP.
- **Dado** el correo escrito con mayúsculas o espacios, **entonces** se normaliza antes de buscarlo.
- **Dado** el proyecto de pruebas y el de producción, **entonces** Supabase Auth envía el correo por el SMTP de Resend, desde el dominio de VolleyTip. En local llega al buzón de pruebas de Supabase.

### RF-3 · Entrar con Google · Should

El botón "Continuar con Google" entra con la cuenta de Google cuyo correo es del equipo (FR-058). Es una comodidad: el enlace mágico ya deja entrar a todo el equipo. Google solo comprueba que la persona es dueña de un correo que ya fue invitado.

- **Dado** una cuenta de Google cuyo correo es de un admin o staff activo, **cuando** vuelve de Google, **entonces** queda con sesión y llega al panel.
- **Dado** un miembro invitado por correo que nunca ha usado Google, **cuando** entra con Google por primera vez con el registro público apagado, **entonces** la identidad de Google se une a su cuenta existente y no se crea otra. No se da por hecho: lo comprueba Camilo a mano en el proyecto de pruebas, con credenciales reales, antes de cerrar el ticket.
- **Dado** una cuenta de Google cuyo correo no es del equipo, **entonces** no queda con sesión, no se crea ninguna cuenta y la pantalla dice que ese correo no tiene acceso.
- **Dado** que la persona cancela en Google o Google devuelve un error, **entonces** vuelve a la pantalla de entrada con un mensaje y sin sesión.
- **Dado** un entorno sin las credenciales de Google configuradas, **entonces** el botón no se pinta y el enlace mágico sigue funcionando.

### RF-4 · Guardia de `/admin` y roles · Must

Ninguna página ni acción del panel responde sin un perfil activo con el rol que pide.

- **Dado** una petición a cualquier ruta bajo `/admin` sin sesión, **entonces** redirige a la pantalla de entrada y, al entrar, vuelve a la página que pidió.
- **Dado** una sesión de un perfil `buyer`, **entonces** recibe 404, igual que una página que no existe (AC-033).
- **Dado** una sesión de un perfil `staff`, **entonces** ve una sola pantalla que explica que su acceso es para el escáner de un camp, con "Cerrar sesión". No ve ninguna sección del panel.
- **Dado** un admin desactivado con la sesión todavía abierta, **cuando** hace la siguiente petición, **entonces** pierde el acceso. El rol y el estado se leen del perfil en cada petición, no del token.
- **Dado** una acción (`POST`) del panel, **entonces** pasa por la misma guardia que la página y rechaza una petición cuyo origen no es el sitio.
- **Dado** cualquier página del panel, **entonces** lleva `noindex` y no aparece en el sitemap.
- **Dado** el modo mantenimiento encendido, **entonces** `/admin` y `/en/admin` siguen respondiendo (FR-056).

### RF-5 · Primer admin · Must

Cada entorno necesita un primer admin antes de que exista la pantalla de equipo.

- **Dado** un entorno sin ningún admin, **cuando** Camilo corre el comando con un correo, **entonces** queda creada la cuenta y su perfil con rol `admin`.
- **Dado** un correo que ya tiene perfil, **entonces** el comando lo sube a `admin` y lo deja activo, sin duplicar nada.
- **Dado** el comando, **entonces** pide confirmación con el nombre del proyecto antes de escribir y deja una entrada en la bitácora.
- **Dado** el repositorio, **entonces** no contiene ningún correo del equipo.

### RF-6 · Cáscara del panel y módulos · Must

Todas las pantallas del panel comparten una cáscara: menú lateral en computador y barra inferior en celular (FR-066, FR-079).

- **Dado** una lista de módulos en el código, cada uno con su dirección, su nombre, su rol y su lugar en el menú, **entonces** el menú lateral y la barra inferior se arman de esa lista. Agregar una sección es agregar un módulo.
- **Dado** el menú lateral, **entonces** conserva el orden del mockup y solo muestra los módulos que existen: Resumen, Mensajes, Textos del sitio, Preguntas frecuentes, Idiomas y mercados, Ajustes, Equipo y Bitácora.
- **Dado** un módulo con algo pendiente (mensajes nuevos), **entonces** su entrada muestra el número.
- **Dado** el panel a menos de 768 px, **entonces** no hay menú lateral: hay una barra inferior fija con los lugares de FR-066 que existan (decisión 10) y "Más" lista los demás módulos y "Cerrar sesión".
- **Dado** la cáscara, **entonces** muestra el nombre y el rol de quien entró y un selector de idioma.
- **Dado** el selector de idioma, **cuando** se cambia, **entonces** el panel pasa a la otra versión de la misma pantalla y el idioma queda guardado en el perfil.
- **Dado** la entrada del módulo actual, **entonces** se marca a la vista y con `aria-current="page"`.

### RF-7 · Acción del admin con bitácora · Must

Toda escritura del panel pasa por una sola pieza que comprueba el permiso, ejecuta el cambio y lo registra (FR-067).

- **Dado** una escritura hecha desde el panel, **entonces** deja en `audit_log` quién la hizo, la acción como `entidad.verbo`, la entidad, su id y el antes y el después de lo que cambió.
- **Dado** que el registro en la bitácora falla, **entonces** la acción responde con error y la pantalla lo dice. Una acción no queda sin registro en silencio.
- **Dado** una entrada de la bitácora, **entonces** no contiene secretos, tokens ni el cuerpo de un mensaje de contacto.
- **Dado** una acción del panel escrita sin esa pieza, **entonces** una prueba del repositorio falla.

### RF-8 · Resumen · Must

La pantalla de inicio del panel muestra lo que pide atención (FR-059, en la parte que existe hoy).

- **Dado** el resumen, **entonces** saluda por el nombre del perfil y muestra: mensajes sin responder, inscritos en la lista de espera de la app, inscritos en "Avísame" y la última actividad de la bitácora.
- **Dado** la tarjeta de mensajes, **cuando** se toca, **entonces** abre la bandeja filtrada por nuevos.
- **Dado** el resumen sin nada que mostrar, **entonces** cada tarjeta muestra cero y la actividad dice que todavía no hay nada.
- **Dado** el registro de módulos, **entonces** un módulo puede aportar su tarjeta al resumen. Las de ventas, pedidos, camps y stock entran así, con su épica.

### RF-9 · Bandeja de mensajes · Must

Los mensajes de contacto se leen y se cierran desde el panel (FR-064, sin el envío).

- **Dado** la bandeja, **entonces** lista los mensajes del más reciente al más antiguo, de 50 en 50, con nombre, motivo, fecha y estado.
- **Dado** los filtros por motivo y por estado y la búsqueda por nombre o correo, **entonces** se combinan, viven en la URL y se conservan al recargar.
- **Dado** un mensaje, **cuando** se abre, **entonces** muestra todos sus campos, incluidos los propios del motivo (número de pedido, marca), el idioma, el país y la versión de privacidad aceptada.
- **Dado** el cuerpo de un mensaje con HTML o enlaces, **entonces** se pinta como texto.
- **Dado** un mensaje, **entonces** ofrece "Responder por correo", que abre el programa de correo con el destinatario y el asunto, y "Escribir por WhatsApp" si la persona dejó número.
- **Dado** un mensaje nuevo, **cuando** el admin lo marca respondido, **entonces** pasa a `answered` con quién y cuándo, y deja de contar en el resumen.
- **Dado** un mensaje, **entonces** se puede archivar y volver a abrir. No se puede borrar ni editar.
- **Dado** la bandeja vacía o un filtro sin resultados, **entonces** lo dice y ofrece quitar los filtros.

### RF-10 · Barra de anuncios y cifras · Must

"Textos del sitio" edita lo que el sitio ya lee de `settings.announcement_bar` y de `site_texts` (FR-065, AC-021).

- **Dado** la barra, **entonces** el admin edita hasta tres mensajes, cada uno con su texto en español y en inglés, y los ordena.
- **Dado** un cambio guardado en la barra, **entonces** aparece en todas las páginas públicas en menos de un minuto, en el idioma de cada una (AC-021).
- **Dado** un mensaje sin texto en inglés, **entonces** la pantalla avisa que en `/en/` saldrá en español.
- **Dado** la barra sin mensajes, **entonces** se puede guardar así y el sitio no la pinta.
- **Dado** las cifras de la home, **entonces** el admin edita el valor y la etiqueta de cada una, por idioma. Una cifra sin valor no se pinta en el sitio.
- **Dado** un texto más largo que su límite, **entonces** el servidor lo rechaza y la pantalla lo marca junto al campo.

### RF-11 · Preguntas frecuentes · Must

El admin crea, traduce, ordena y publica las preguntas frecuentes (FR-065, FR-137, AC-065).

- **Dado** la lista, **entonces** muestra todas las preguntas con su estado y en el orden en que salen en el sitio.
- **Dado** una pregunta nueva, **entonces** nace en borrador y no aparece en el sitio.
- **Dado** el editor, **entonces** tiene una pestaña por idioma activo y marca cuáles tienen traducción.
- **Dado** una pregunta publicada solo en español, **entonces** en `/en/` sale en español (AC-065).
- **Dado** una pregunta sin texto en español, **entonces** no se puede publicar.
- **Dado** "Subir" y "Bajar" en la lista, **entonces** cambian el orden y el sitio lo refleja. Funcionan con teclado.
- **Dado** una pregunta publicada, **entonces** se puede retirar. Retirada no sale en el sitio y sigue en la lista. No se borra.

### RF-12 · Idiomas, mercados y tasa del dólar · Must

Una pantalla para lo que W2 dejó sembrado por migración (FR-065, FR-009, FR-122).

- **Dado** la lista de idiomas, **entonces** el admin activa o desactiva un idioma. El idioma por defecto no se puede desactivar.
- **Dado** la lista de mercados, **entonces** el admin edita de cada uno si está activo, si recibe envíos físicos, el idioma por defecto y los medios de pago.
- **Dado** el único mercado activo, **cuando** se intenta desactivar, **entonces** la base lo rechaza y la pantalla explica por qué.
- **Dado** la tasa de referencia del dólar, **entonces** el admin la escribe como un entero positivo de pesos por dólar y el precio aproximado del sitio la usa desde el siguiente pedido de página.
- **Dado** una tasa vacía, cero, negativa o con letras, **entonces** se rechaza.

### RF-13 · Ajustes del sitio · Must

Los interruptores que hoy solo existen como filas en `settings` (FR-056, FR-054).

- **Dado** el modo mantenimiento, **cuando** el admin lo enciende, **entonces** pide confirmación, el sitio público pasa a mantenimiento en menos de un minuto y el panel sigue funcionando.
- **Dado** el mantenimiento encendido, **entonces** todas las pantallas del panel lo avisan con una franja visible.
- **Dado** el estado de la app, **entonces** el admin elige entre lista de espera y disponible. Disponible exige al menos una dirección de tienda, y cada dirección debe ser `https` de App Store o de Google Play.
- **Dado** los identificadores de enlaces de app (`app_links`), **entonces** se pueden editar con la validación que ya usa el sitio. _(Could: puede quedarse en la base hasta que exista la app.)_

### RF-14 · Equipo · Must

El admin decide quién entra al panel (FR-058, FR-065).

- **Dado** la pantalla de equipo, **entonces** lista los perfiles `admin` y `staff` con nombre, correo, rol, estado y último ingreso. No lista compradores.
- **Dado** un correo nuevo, **cuando** el admin lo invita con nombre y rol, **entonces** queda creada la cuenta con ese rol y la persona puede entrar con enlace o con Google.
- **Dado** un correo que ya es comprador, **cuando** se invita, **entonces** su perfil sube al rol elegido y conserva su historial.
- **Dado** un miembro, **entonces** el admin puede cambiarle el rol, desactivarlo y volver a activarlo. Desactivar cierra sus sesiones.
- **Dado** el último admin activo, **cuando** se intenta desactivar o bajar de rol, **entonces** la base lo rechaza, también si dos admins lo intentan a la vez el uno con el otro.
- **Dado** un admin, **entonces** no puede desactivarse ni bajarse el rol a sí mismo.
- **Dado** un perfil del equipo, **entonces** no se borra: se desactiva (DR-006).

### RF-15 · Lectura de la bitácora · Should

- **Dado** la pantalla de bitácora, **entonces** lista las entradas de la más reciente a la más antigua, de 50 en 50, con fecha, quién, acción y entidad.
- **Dado** los filtros por persona, por acción y por rango de fechas, **entonces** viven en la URL.
- **Dado** una entrada, **cuando** se abre, **entonces** muestra el antes y el después.
- **Dado** la pantalla, **entonces** no ofrece editar ni borrar.

### RF-16 · Envíos descartados en el resumen · Could

- **Dado** los contadores de `form_rejections`, **entonces** el resumen muestra cuántos envíos se descartaron en los últimos siete días, por formulario y por motivo. Sirve para ver un ataque o un Turnstile mal configurado.

## 6. Casos borde y estados de error

- **Enlace abierto en otro navegador o dispositivo:** funciona. El enlace no depende de una cookie del navegador que lo pidió.
- **Enlace que abre un lector de correo antes que la persona:** algunos correos corporativos visitan los enlaces. La página del enlace no canjea al cargar: muestra un botón "Entrar" y canjea al enviarlo.
- **Dos enlaces pedidos seguidos:** solo sirve el último. El límite por IP corta el abuso.
- **Correo de Google distinto al invitado:** no entra. La pantalla dice con qué correo intentó.
- **Sesión que vence a mitad de un formulario largo:** al guardar, la persona vuelve a entrar y regresa a la pantalla. Lo escrito se pierde; ningún formulario de esta épica es largo.
- **Admin desactivado con una pestaña abierta:** su siguiente petición lo saca. Una acción suya que ya estaba en curso termina.
- **Dos admins editan lo mismo a la vez:** gana el último, y la bitácora guarda los dos cambios con su antes y después (decisión de W2 y W3).
- **Último admin:** la regla vive en la base, con bloqueo, no en la pantalla.
- **Perfil sin nombre:** el saludo y la cáscara usan el correo.
- **Mensaje de contacto enorme:** el detalle lo muestra completo y conserva los saltos de línea; la lista lo corta.
- **1.000 mensajes o 10.000 entradas de bitácora:** paginación en el servidor, nunca la tabla entera.
- **Ajuste con una forma inválida en la base:** la pantalla lo muestra como inválido y deja corregirlo, en vez de fallar al abrir.
- **Mantenimiento encendido por error y sesión perdida:** la pantalla de entrada del panel sigue disponible en mantenimiento.
- **Texto en inglés más largo:** el menú lateral y la barra inferior se revisan en los dos idiomas.
- **Supabase Auth caído:** la pantalla de entrada lo dice. El sitio público no se afecta.
- **Concurrencia en las migraciones:** los tickets con migración van uno tras otro, en el mismo carril que cualquier otra épica abierta.

## 7. UX / UI

- **Mockups:** `docs/mockups/AdminLogin.png` (entrada), `Admin.png` (cáscara y resumen) y `AdminMovil--inicio.png` y `AdminMovil--mas.png` (celular). El detalle de un mensaje está en `docs/mockups/source/Admin.dc.html`.
- **Sin mockup:** preguntas frecuentes, ajustes, equipo, bitácora, la pantalla del staff y la entrada en celular. Se construyen desde `Admin.png` y `design-system.md`.
- **Donde manda este documento y no el mockup:** el menú lateral no muestra Tips, Productos, Pedidos, Camps ni Galerías hasta que existan. El resumen no trae ventas, pedidos, camps ni stock. La respuesta desde el panel con plantillas y adjuntos no se construye aquí. No hay buscador general.
- **Zona clara:** el contenido del panel va sobre fondo claro y el menú sobre `brand-night`, como en el mockup.
- **Flujo principal:** Andrés abre `/admin` en el celular, escribe su correo, toca el enlace que le llega, ve tres mensajes nuevos, abre uno, lo contesta por WhatsApp y lo marca respondido.
- **Flujo de contenido:** Camilo entra con Google, cambia el segundo mensaje de la barra de anuncios, guarda y lo ve en la home.
- **Viewports a soportar:** 360, 390, 768 y 1440 px.

## 8. Requerimientos no funcionales

- **Seguridad:** toda la épica es área de revisión humana (plan maestro, "Acceso al admin"). Ninguna llave secreta llega al navegador. Las consultas del panel usan la sesión de la persona y RLS; el servidor comprueba el rol en cada petición. Las acciones rechazan orígenes ajenos.
- **Privacidad:** la entrada no revela si un correo es del equipo. La bitácora no guarda cuerpos de mensajes ni tokens.
- **Rendimiento:** listados en menos de un segundo con 1.000 registros (NFR-002), con paginación e índices por fecha y estado.
- **Accesibilidad:** WCAG 2.2 AA, foco visible, zonas de toque de 44 px, tablas con encabezados y todo manejable con teclado.
- **Idiomas:** ningún texto escrito en los componentes; la prueba de textos del CI cubre también el panel (AC-002).
- **SEO:** todo el panel con `noindex` y fuera del sitemap.
- **Portabilidad:** nada exclusivo de Railway (NFR-011).
- **Dependencias nuevas de ejecución:** `@supabase/ssr`, para manejar la sesión de Supabase Auth en cookies del lado del servidor. Se confirma contra la documentación vigente en el ticket 1.
- **Variables y configuración nuevas:** las credenciales de Google viven en Supabase, no en el servidor. Si el ticket 1 necesita una variable para firmar o nombrar las cookies, se declara en `.env.example` y `docs/entornos.md`.

## 9. Decisiones y preguntas abiertas

Camilo decidió las tres primeras, la 7 y la 8 el 25 de noviembre de 2026, y aprobó el documento ese día con las demás como estaban propuestas.

- [x] **1. El editor de tips pasa a W4.** W4 crea las tablas, el editor y las páginas públicas juntos, igual que W5 y W8 construyen su propio editor.
- [x] **2. Responder desde el panel pasa a W11a.** Aquí queda la bandeja; el envío con plantillas y adjuntos llega con Resend.
- [x] **3. El panel va en español y en inglés.**
- [x] **4. Direcciones.** Propuesta: `/admin` y `/en/admin`, con el mismo mapa de páginas del sitio, y la entrada en `/admin/entrar` y `/en/admin/sign-in`. El idioma sale de la dirección, como en el resto del sitio; al entrar se va al idioma guardado en el perfil. (Camilo)
- [x] **5. Registro público apagado.** Propuesta: `enable_signup = false` en Supabase Auth. Nadie crea una cuenta desde el navegador, ni con Google. Las cuentas las crea el servidor: el equipo desde la pantalla de equipo, y los compradores cuando llegue W14. Sin esto, cualquier cuenta de Google dejaría un usuario y un perfil `buyer`. (Camilo)
- [x] **6. Primer admin por comando.** Propuesta: un comando que Camilo corre una vez por entorno con su llave de servicio. La alternativa, una migración con los correos, deja correos personales en el repositorio. (Camilo)
- [x] **7. El correo del enlace sale por Resend desde esta épica.** Camilo ya tiene la cuenta de Resend y el dominio verificado, así que el ticket 2 conecta el SMTP de Resend en Supabase Auth, en pruebas y en producción. En local el correo llega al buzón de pruebas de Supabase. El acceso al admin ya no depende de W11a. Pegar las credenciales en el panel de Supabase lo hace Camilo.
- [x] **8. Google se queda, de último.** Es seguro porque hay dos candados: con el registro apagado (decisión 5) una cuenta de Google no invitada no crea nada, y la guardia solo abre a un perfil admin o staff activo (RF-4). El segundo es el de fondo: cuando W14 encienda el registro de compradores, el rol es lo único que protege el panel. El cliente OAuth se crea una vez en Google Cloud, con las direcciones de retorno de pruebas y de producción en el mismo cliente, y se pega en Supabase. Solo lo puede hacer Camilo. El ticket 14 no se cierra sin eso y no bloquea a ningún otro.
- [x] **9. Duración de la sesión.** Propuesta: la sesión dura hasta que la persona la cierra o el admin la desactiva, como trae Supabase por defecto. El vencimiento por inactividad es una función del plan Pro; se revisa al pasar a Pro antes de L1. (Camilo)
- [x] **10. Barra inferior en celular.** FR-066 fija cinco lugares: Inicio, Pedidos, Subir tip, Camps y Más. Hoy solo existen dos. Propuesta: la barra muestra los que existan y, mientras Pedidos no exista, Mensajes ocupa un lugar: Inicio, Mensajes y Más. Cada épica agrega el suyo. (Se decide al construir, salvo objeción)
- [x] **11. El staff entra, pero no ve nada.** Propuesta: un staff con cuenta puede entrar desde ya y ve una pantalla que lo explica. Así la pantalla de equipo puede crear staff sin esperar a W9. (Se decide al construir, salvo objeción)
- [x] **12. Spam.** El mockup tiene "Marcar como spam" y `message_status` no tiene ese valor. Propuesta: no se agrega; un mensaje basura se archiva. (Se decide al construir, salvo objeción)
- [x] **13. Buscador general.** El mockup lo muestra arriba a la derecha. Propuesta: no se construye; cada listado tiene su búsqueda. Se revisa cuando existan pedidos. (Se decide al construir, salvo objeción)
- [x] **14. Plantilla del correo del enlace.** Canjear el enlace en el servidor pide cambiar la plantilla del correo de Supabase para que apunte al sitio. En local va en `supabase/config.toml`; en los proyectos alojados se cambia en el panel de Supabase, a mano. (Camilo, con el ticket 2)

## 10. Descomposición en tickets (para write-ticket)

Los 14 tickets cuelgan de la épica #5 y se crearon el 25 de noviembre de 2026 como #119 a #132, en el orden de la tabla (el ticket 1 es el #119 y el 14 es el #132). Toda la épica es área de revisión humana: ninguno lleva auto-merge.

| #   | Título propuesto                                                      | RF          | Tamaño | Depende de | Auto-merge sugerido                              |
| --- | --------------------------------------------------------------------- | ----------- | ------ | ---------- | ------------------------------------------------ |
| 1   | Guardar la sesión de Supabase Auth en cookies y proteger `/admin`     | RF-1, RF-4  | M      | ninguna    | No: acceso al admin                              |
| 2   | Entrar al admin con un enlace enviado al correo                       | RF-2        | M      | 1          | No: acceso al admin                              |
| 3   | Crear el primer admin de un entorno con un comando                    | RF-5        | S      | 1          | No: crea cuentas con la llave de servicio        |
| 4   | Armar la cáscara del panel con menú lateral, barra inferior y módulos | RF-6        | M      | 1          | No: pide aceptar capturas nuevas                 |
| 5   | Ejecutar cada acción del admin con registro en la bitácora            | RF-7        | S      | 1          | No: es la base de la auditoría                   |
| 6   | Construir el resumen del panel                                        | RF-8, RF-16 | S      | 4          | No: lee datos privados                           |
| 7   | Construir la bandeja de mensajes                                      | RF-9        | M      | 4, 5       | No: datos personales                             |
| 8   | Editar la barra de anuncios y las cifras de la home                   | RF-10       | M      | 4, 5       | No: cambia lo que ve todo el sitio               |
| 9   | Editar las preguntas frecuentes                                       | RF-11       | M      | 4, 5       | No: publica contenido                            |
| 10  | Administrar idiomas, mercados y la tasa del dólar                     | RF-12       | M      | 4, 5       | No: migración y puede dejar el sitio sin precios |
| 11  | Encender el mantenimiento y cambiar el estado de la app desde ajustes | RF-13       | S      | 4, 5       | No: puede dejar el sitio abajo                   |
| 12  | Administrar el equipo: invitar, cambiar rol y desactivar              | RF-14       | M      | 4, 5       | No: permisos y cuentas                           |
| 13  | Leer la bitácora de auditoría                                         | RF-15       | S      | 4, 5       | No: lee datos privados                           |
| 14  | Entrar al admin con Google                                            | RF-3        | S      | 2          | No: acceso al admin; pide credenciales de Camilo |

Carril de migraciones: llevan migración el 10 (la regla del único mercado activo y del idioma por defecto) y el 12 (la regla del último admin). Van uno tras otro. El 1 cambia `supabase/config.toml`, que no es una migración pero sí choca con cualquier otro ticket que lo toque. El 2 y el 14 también lo tocan.

Orden sugerido: 1 primero y solo. Después 2, 3, 4 y 5, que no se pisan entre sí. Con la cáscara y la bitácora listas, los módulos (6 a 13) pueden ir en dos carriles: contenido (8, 9, 11) y gestión (7, 10, 12, 13). El 14 va de último y no bloquea a ninguno.

Tickets que necesitan a Camilo: el 2 (pegar el SMTP de Resend y la plantilla del correo en los proyectos alojados, y apagar el registro), el 3 (correr el comando en pruebas y en producción) y el 14 (un cliente OAuth de Google para los dos entornos).

Sugerencia de `ui-review`: tickets 2, 4, 6, 7, 8, 9 y 12. Los demás reutilizan la cáscara y los componentes de formulario; con las capturas basta.

Cruces con otras épicas:

- **W4 (#4):** recibe el editor de tips (FR-060) y agrega su módulo y su lugar "Subir tip" en la barra inferior.
- **W11a (#6):** recibe el envío de respuestas desde la bandeja (resto de FR-064) y viste el correo de acceso con la plantilla común.
- **W10b, W8 y W5:** agregan sus tarjetas al resumen y sus módulos.
- **W9:** construye la pantalla del staff sobre la guardia de este PRD.

Skill que falta: sigue sin existir `supabase-practices`. Los tickets 1, 2, 10 y 12 la usarían.
