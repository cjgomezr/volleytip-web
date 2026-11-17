# PRD: W1 · Fundación técnica y entornos

**Estado:** aprobado por Camilo el 17 de noviembre de 2026 · **Fecha:** 11 de noviembre de 2026 · **Autor:** Claude Code

Épica: #1. Fuente: `docs/plan-maestro.md`, `docs/SRD-volleytip-web-v1.4.md` (FR-070, FR-076, FR-077, FR-123, FR-124, FR-135; AC-030, AC-033, AC-063) y `docs/modelo-de-datos.md` (secciones 1, 4, 13, 14 y 15).

Este PRD no repite las decisiones técnicas transversales del plan maestro. Donde las concreta, lo dice.

## 1. Problema

El bootstrap dejó una cáscara: React Router con SSR, Tailwind 4 con los tokens de marca, una home provisional, `/healthz` y el CI corriendo lint, tipos y pruebas. No hay base de datos, ni entornos desplegados, ni componentes, ni protección de formularios.

Todas las épicas siguientes dan eso por hecho. W2 necesita tablas y RLS. W3 necesita botones, campos y un formulario de contacto protegido. W10a necesita perfiles con rol. Si cada épica resuelve esas piezas por su cuenta, aparecen tres formas de validar un formulario y tablas sin RLS.

## 2. Usuarios y contexto

- **Usuario primario:** quien construye las épicas W2 en adelante. Es la fábrica (un agente sin nadie a quien preguntarle) y Camilo cuando revisa. Necesitan piezas con un contrato claro y pruebas que fallen cuando se usan mal.
- **Usuario indirecto:** el visitante de volleytip.com. De W1 solo percibe que las imágenes cargan rápido sin saltos y que los formularios no le piden nada raro.
- **Hoy lo resuelve así:** no se resuelve. La web actual (Strapi en DigitalOcean) no comparte nada con este repo.

Esta épica **se hace acompañada, no con la fábrica** (plan maestro). Varios tickets necesitan que Camilo cree cuentas, proyectos y secretos que un agente no puede ni debe crear.

## 3. Objetivo y métricas de éxito

- **Objetivo:** que W2, W10a y W11a puedan empezar en paralelo sin crear infraestructura propia.
- **Métricas:**
  - `staging.volleytip.com` sirve la rama `main` por HTTPS contra `volleytip-dev`, y el entorno de producción despliega la misma rama y responde en su URL de Railway contra `volleytip-prod`.
  - Un PR con una migración que deja los tipos desactualizados, o una tabla sin RLS, sale rojo en el CI.
  - Un formulario nuevo queda protegido con las cinco capas de FR-135 llamando a una sola función del servidor.
  - Ningún secreto aparece en `build/client`.

## 4. Alcance

**Incluido (v1):**

- Supabase en el repo: CLI, migraciones, base local desechable para las pruebas, tipos generados y su chequeo en el CI.
- Dos proyectos de Supabase (`volleytip-dev` y `volleytip-prod`) y el flujo que les aplica las migraciones.
- Esquema base: `profiles`, `settings`, `audit_log`, `rate_limits`, `form_rejections`, con RLS y sus funciones.
- Módulo de variables de entorno y clientes de Supabase del lado del servidor.
- Despliegue en Railway: pruebas y producción.
- Componentes base de `design-system.md` y una página de muestra para verlos y compararlos.
- Imágenes por Bunny Optimizer: constructor de URL y componente de imagen.
- Utilidad de formularios protegidos (FR-135).

**Explícitamente fuera (por ahora):**

- Login, sesiones con cookies y pantallas del admin. Son de W10a (#5). W1 crea la tabla de perfiles y sus políticas; no crea ninguna pantalla de acceso ni el primer admin.
- Las claves iniciales de `settings` (modo mantenimiento, barra de anuncios, tope anual). Cada una la siembra la épica que la usa. W1 entrega la tabla y cómo leerla.
- La página de mantenimiento y las de error (FR-056, W3).
- El contador de envíos descartados en el admin. W1 guarda los contadores; mostrarlos es de W10a.
- El formulario de contacto. AC-063 lo nombra, pero el formulario es de W3 (#3). En W1 las cinco capas se prueban contra un formulario de prueba que vive solo en los tests.
- La regla propia del registro al VBall Tour (FR-136). W1 deja el límite configurable para que W15 la aplique.
- Idiomas y archivos de traducción (W2). Los componentes base reciben sus textos por props.
- Llaves de Wompi, Resend y Bunny Stream. Cada épica agrega sus variables al módulo de entorno.
- El reproductor de video con portada (parte de FR-123). Va con los tips en W4.
- Copias de seguridad, restauración probada y monitoreo (NFR-009). No están asignados a ninguna épica: ver pregunta abierta 4.
- Analítica. La fase 1 no tiene (FR-124).

## 5. Requerimientos funcionales

### RF-1 · Supabase en el repo con base local desechable · Must

El repo contiene la configuración de Supabase CLI (`supabase/config.toml`) y las migraciones en `supabase/migrations/`. Un comando levanta una base local, otro la reconstruye desde cero. Las pruebas de integración corren contra esa base local, nunca contra `volleytip-dev`.

- **Dado** un clon limpio en una máquina con Docker (opcional en la de cada persona, siempre presente en el CI), **cuando** se corre `npm run db:start` y luego `npm run db:reset`, **entonces** queda una base local con todas las migraciones aplicadas y el comando termina con código 0.
- **Dado** que `RUN_INTEGRATION_TESTS` no está definida, **cuando** corre `npm test`, **entonces** las pruebas de integración se saltan y el resumen dice cuántas se saltaron.
- **Dado** `RUN_INTEGRATION_TESTS=1` y la base local apagada, **cuando** corre `npm test`, **entonces** falla con un mensaje que dice que la base local no responde y cómo levantarla. No se salta en silencio.
- **Dado** un PR que no es de solo texto, **cuando** corre el workflow `checks`, **entonces** levanta la base local antes del paso `Tests` y las pruebas de integración corren contra ella.
- **Dado** un PR de solo texto, **cuando** corre `checks`, **entonces** no levanta la base local.

### RF-2 · Variables de entorno validadas y clientes de servidor · Must

Un módulo de servidor (`src/lib/env.server.ts`) lee, valida y tipa las variables de entorno. Es el único lugar del código que lee `process.env`. Dos fábricas de cliente de Supabase viven en módulos `*.server.ts`: una con la llave pública y otra con la llave de servicio.

- **Dado** que falta una variable obligatoria, **cuando** arranca el servidor, **entonces** falla de inmediato con un mensaje que nombra la variable y no imprime el valor de ninguna.
- **Dado** `APP_ENV` con un valor distinto de `local`, `test`, `staging` o `production`, **cuando** arranca el servidor, **entonces** falla nombrando los valores válidos.
- **Dado** el build de producción, **cuando** se busca el valor de la llave de servicio y de los demás secretos en `build/client`, **entonces** no aparece ninguno.
- **Dado** el código de `src/`, **cuando** corre la prueba de portabilidad, **entonces** falla si algún archivo distinto de `env.server.ts` lee `process.env` o si alguno lee una variable que empiece por `RAILWAY_` (FR-124, NFR-011).
- **Dado** el repo, **entonces** existe `.env.example` versionado con el nombre de cada variable, sin valores reales, y `.gitignore` lo deja pasar.

### RF-3 · Dos proyectos de Supabase y migraciones aplicadas por el CI · Must

Existen `volleytip-dev` y `volleytip-prod` en una misma organización de Supabase (`volleytip-web`), en la región US East. Durante el desarrollo la organización está en el plan gratis y pasa a Pro antes del lanzamiento L1 (sección 9). Nadie cambia el esquema a mano: las migraciones las aplica un workflow en cada merge a `main`, primero a pruebas y después a producción.

- **Dado** un merge a `main` que trae una migración nueva, **cuando** termina el workflow de migraciones, **entonces** `volleytip-dev` tiene esa migración aplicada.
- **Dado** un merge a `main` sin migraciones nuevas, **cuando** corre el workflow, **entonces** termina en verde sin cambiar nada.
- **Dado** que la migración se aplicó bien a `volleytip-dev`, **cuando** sigue el workflow, **entonces** la aplica a `volleytip-prod`. **Dado** que falló en `volleytip-dev`, **entonces** el workflow se detiene en rojo y `volleytip-prod` no se toca.
- **Dado** un PR abierto o una rama distinta de `main`, **entonces** el workflow de migraciones no corre: solo un merge a `main` cambia una base remota.
- **Dado** que falta un secreto del workflow, **cuando** corre, **entonces** falla nombrando el secreto que falta.
- **Dado** una migración que falla a mitad, **cuando** termina el workflow, **entonces** queda en rojo y la migración no queda aplicada a medias (cada migración corre en una transacción).

### RF-4 · Perfiles con rol · Must

Tabla `profiles` según `docs/modelo-de-datos.md`, con el enum `user_role` (`admin`, `staff`, `buyer`). Un disparador crea el perfil cuando Supabase Auth crea un usuario. La función `is_admin()` es la única forma en que una política pregunta si quien consulta es admin (FR-077, AC-033).

- **Dado** un usuario nuevo en Supabase Auth, **cuando** se crea, **entonces** existe su fila en `profiles` con `role = 'buyer'`, `is_active = true` y el correo normalizado (minúsculas, sin espacios).
- **Dado** un usuario cuyo correo llega como `Juan@Gmail.com`, **cuando** se crea su perfil, **entonces** `email` queda `juan@gmail.com`.
- **Dado** un comprador con sesión, **cuando** lee `profiles`, **entonces** recibe solo su fila.
- **Dado** un comprador con sesión, **cuando** actualiza su `full_name` o su `locale`, **entonces** se guarda; **cuando** intenta cambiar `role`, `email` o `is_active`, **entonces** se rechaza y la fila no cambia.
- **Dado** un staff con sesión, **cuando** lee `profiles`, **entonces** recibe solo su fila y no puede editarla.
- **Dado** un admin activo con sesión, **cuando** lee o edita `profiles`, **entonces** puede con todas las filas.
- **Dado** un admin con `is_active = false`, **cuando** consulta, **entonces** `is_admin()` devuelve falso y no ve más que su propia fila.
- **Dado** un cliente sin sesión, **cuando** consulta `profiles`, **entonces** recibe cero filas.
- **Dado** el rol `buyer`, **cuando** corre la prueba de AC-033, **entonces** ninguna política de las tablas de W1 le da acceso de admin, y agregar un comprador no necesita ninguna migración nueva.

### RF-5 · Ajustes · Must

Tabla `settings` (`key`, `value` jsonb, `updated_by`, `updated_at`). El servidor la lee con una función tipada. No tiene claves sembradas en W1.

- **Dado** un cliente sin sesión, un comprador o un staff, **cuando** consultan `settings`, **entonces** reciben cero filas y no pueden escribir.
- **Dado** un admin activo, **cuando** lee o actualiza un ajuste, **entonces** puede, y `updated_by` y `updated_at` quedan con su id y la hora.
- **Dado** una clave que no existe, **cuando** el servidor la pide con su valor por defecto, **entonces** recibe el valor por defecto.
- **Dado** una clave cuyo valor guardado no cumple la forma esperada, **cuando** el servidor la pide, **entonces** recibe un error que nombra la clave. No recibe el valor por defecto en silencio.

### RF-6 · Bitácora de auditoría de solo inserción · Must

Tabla `audit_log` según el modelo de datos. Solo se inserta, y solo desde el servidor.

- **Dado** el servidor, **cuando** registra una acción con actor, acción, entidad, id y detalles, **entonces** queda una fila con `created_at` puesto por la base de datos.
- **Dado** cualquier rol, incluida la llave de servicio, **cuando** intenta actualizar o borrar una fila de `audit_log`, **entonces** la base de datos lo rechaza.
- **Dado** un admin activo, **cuando** lee `audit_log`, **entonces** puede. **Dado** cualquier otro rol o un cliente sin sesión, **entonces** recibe cero filas.
- **Dado** un cliente con sesión de admin, **cuando** intenta insertar directo en `audit_log` desde el navegador, **entonces** se rechaza: las entradas solo las escribe el servidor.

### RF-7 · Límites de frecuencia y contadores de rechazos · Must

Tablas `rate_limits` y `form_rejections` según el modelo de datos, con dos funciones de Postgres. `check_rate_limit` cuenta y decide en una sola operación atómica. `record_form_rejection` suma al contador del día. Una tarea diaria borra los límites vencidos.

- **Dado** un límite de 5 en 10 minutos y una clave sin uso, **cuando** se llama `check_rate_limit` 5 veces, **entonces** las 5 devuelven permitido; **cuando** se llama la sexta, **entonces** devuelve rechazado.
- **Dado** el mismo límite y 10 llamadas simultáneas con la misma clave, **entonces** exactamente 5 devuelven permitido.
- **Dado** una clave que llegó al límite, **cuando** pasan 10 minutos, **entonces** la siguiente llamada devuelve permitido.
- **Dado** dos rechazos del formulario `contact` por `honeypot` el mismo día, **cuando** se registran, **entonces** hay una sola fila con `count = 2`.
- **Dado** `form_rejections`, **entonces** no tiene ninguna columna que pueda guardar contenido del envío, correo ni IP.
- **Dado** filas de `rate_limits` con la ventana vencida hace más de un día, **cuando** corre la tarea de limpieza, **entonces** se borran y las vigentes quedan.
- **Dado** un cliente sin sesión, un comprador o un staff, **cuando** consultan cualquiera de las dos tablas o llaman las funciones desde el navegador, **entonces** se rechaza. Un admin puede leerlas y no escribirlas.

### RF-8 · RLS por defecto y ámbito de cada tabla, vigilados por una prueba · Must

Una prueba de integración revisa el catálogo de Postgres. Protege a todas las épicas siguientes, no solo a W1. También concreta FR-076: todas las tablas viven en el esquema `public` y cada una declara en su comentario si es compartida con la app (`scope: shared`) o solo de la web (`scope: web`).

- **Dado** una migración que crea una tabla en `public` sin activar RLS, **cuando** corre la prueba, **entonces** falla nombrando la tabla.
- **Dado** una tabla sin comentario de ámbito, o con un valor distinto de `shared` o `web`, **cuando** corre la prueba, **entonces** falla nombrando la tabla.
- **Dado** las tablas de W1, **entonces** `profiles` es `shared` y `settings`, `audit_log`, `rate_limits` y `form_rejections` son `web`.
- **Dado** una tabla con RLS activado y sin políticas, **cuando** un cliente sin sesión la consulta con la llave pública, **entonces** recibe cero filas.

### RF-9 · Tipos generados y su chequeo en el CI · Must

Los tipos de TypeScript de la base de datos se generan desde la base local y se versionan. Los clientes de Supabase están tipados con ellos.

- **Dado** el repo, **cuando** se corre `npm run db:types`, **entonces** regenera el archivo de tipos desde la base local.
- **Dado** un PR con una migración y el archivo de tipos sin regenerar, **cuando** corre `checks`, **entonces** falla con un mensaje que dice que se corra `npm run db:types`.
- **Dado** un PR sin cambios de esquema, **cuando** corre el chequeo, **entonces** pasa sin modificar nada.

### RF-10 · Entornos en Railway · Must

Dos servicios en Railway, en US East, y los dos despliegan `main` solos con cada merge: pruebas, que responde en `staging.volleytip.com` contra `volleytip-dev`, y producción, contra `volleytip-prod`. Producción todavía no recibe el dominio `volleytip.com`: eso es W13 (FR-070, FR-124, AC-030).

Railway espera a que los workflows de GitHub de ese commit terminen en verde antes de desplegar (opción "Wait for CI"). Así el código nuevo nunca llega antes que su migración. Al llegar el lanzamiento (W13) se decide si producción gana un paso manual.

- **Dado** un merge a `main` con los checks y las migraciones en verde, **cuando** Railway termina el despliegue, **entonces** `https://staging.volleytip.com/healthz` y la URL de producción responden 200 con el commit nuevo.
- **Dado** un merge a `main` cuyo workflow de checks o de migraciones termina en rojo, **entonces** Railway no despliega ese commit en ninguno de los dos servicios y sigue sirviendo el anterior.
- **Dado** el entorno de pruebas, **entonces** sus variables apuntan a `volleytip-dev` y `APP_ENV` es `staging`. **Dado** el de producción, **entonces** apuntan a `volleytip-prod` y `APP_ENV` es `production`. Ninguna llave se comparte entre los dos.
- **Dado** cualquier entorno con `APP_ENV` distinto de `production`, **cuando** responde una página, **entonces** la respuesta lleva `X-Robots-Tag: noindex, nofollow`. **Dado** `APP_ENV = production`, **entonces** no lleva esa cabecera.
- **Dado** `/healthz`, **cuando** responde, **entonces** incluye el nombre del entorno y no toca ningún servicio externo.
- **Dado** el repo, **entonces** `docs/entornos.md` lista cada variable por entorno (solo nombres), dónde se obtiene y dónde se pone, y cómo se despliega producción.

AC-030 habla de un pago en el entorno de pruebas. W1 entrega el entorno separado con sus propias llaves. La parte del pago se comprueba en W6b (#11), que es quien agrega las llaves de Wompi.

### RF-11 · Retirado

Pedía un workflow que mantuviera activo el proyecto de pruebas, porque el plan gratis de Supabase pausa los proyectos sin uso. Se retiró el 11 de noviembre de 2026, cuando se decidió una organización Pro. El 17 de noviembre Camilo decidió empezar en el plan gratis, así que la pausa puede volver a ocurrir. Aun así el workflow no se revive: un proyecto pausado se reactiva a mano desde el panel, y la organización pasa a Pro antes del lanzamiento L1. El número se conserva para no mover los demás.

### RF-12 · Componentes base · Must

Los siete componentes de la tabla "Core components" de `design-system.md`, construidos una vez: botón primario, botón secundario, campo de texto, etiqueta de formulario, eyebrow, barra de anuncios y botón de ícono. Reciben sus textos por props. Una página de muestra los enseña en todos sus estados.

- **Dado** cada componente, **cuando** se pinta, **entonces** sus medidas, colores, radios y tipografía son los de `design-system.md`, usando solo tokens de `src/app.css`.
- **Dado** un botón (primario, secundario o de ícono), **entonces** tiene los cinco estados: normal, hover, foco visible, activo y deshabilitado. El anillo de foco es `brand-lime` en zonas oscuras y `brand-night` en zonas claras.
- **Dado** un botón con un destino, **cuando** se pinta, **entonces** es un enlace; **dado** uno sin destino, **entonces** es un `<button>` con `type` explícito.
- **Dado** un botón de ícono sin `aria-label`, **entonces** no compila: el tipo lo exige.
- **Dado** un campo de texto, **entonces** siempre va unido a su etiqueta, mide 52 px de alto y su texto es de 16 px.
- **Dado** un campo con error, **entonces** muestra el mensaje con un ícono, en `brand-red-deep` sobre zonas claras, y el campo queda marcado con `aria-invalid` y enlazado al mensaje con `aria-describedby`.
- **Dado** un botón en estado de envío, **entonces** queda deshabilitado y lo anuncia a lectores de pantalla.
- **Dado** un texto tres veces más largo de lo esperado en cualquier componente, **entonces** no rompe el diseño ni se sale del contenedor.
- **Dado** `APP_ENV` distinto de `production`, **cuando** se abre la página de muestra, **entonces** enseña cada componente en cada estado, en zona oscura y en zona clara. **Dado** `APP_ENV = production`, **entonces** esa ruta responde 404.
- **Dado** la página de muestra en 360, 390, 768 y 1440 px, **cuando** corre Playwright, **entonces** no hay scroll horizontal, axe no reporta violaciones y las capturas coinciden con la línea base.

### RF-13 · Imágenes optimizadas · Must

Un constructor de URL y un componente para las imágenes que sirve Bunny Optimizer (FR-123). Los logos de `public/brand/` no pasan por aquí.

- **Dado** una ruta de imagen y un ancho, **cuando** se construye la URL, **entonces** apunta al dominio configurado del CDN con el ancho pedido como parámetro.
- **Dado** una imagen que se muestra a 400 px, **cuando** se pinta, **entonces** su `srcset` ofrece el ancho normal y el de alta densidad, y lleva `sizes`.
- **Dado** el componente sin `alt`, `width` o `height`, **entonces** no compila.
- **Dado** el componente sin más opciones, **entonces** lleva `loading="lazy"`. **Dado** que se marca como prioritaria, **entonces** lleva `loading="eager"` y `fetchpriority="high"`.
- **Dado** una ruta con espacios o caracteres especiales, **cuando** se construye la URL, **entonces** queda bien codificada.
- **Dado** una ruta que es una URL absoluta de otro dominio, **cuando** se construye la URL, **entonces** se rechaza con un error claro.
- **Dado** una imagen de prueba subida al almacenamiento, **cuando** un navegador que acepta WebP la pide por la URL construida con ancho 400, **entonces** recibe una imagen de 400 px de ancho en WebP o AVIF. Esta comprobación es manual, contra el entorno de pruebas.

### RF-14 · Utilidad de formularios protegidos · Must

Una función de servidor aplica las cinco capas de FR-135 y devuelve un resultado que el `action` no puede ignorar. Un componente pone en el formulario lo que esas capas necesitan: el widget de Turnstile, el campo trampa y la marca de tiempo firmada.

La función devuelve una unión discriminada. Los datos validados solo existen en la variante aceptada:

| Resultado             | Cuándo                                            | Qué ve la persona                                | Se cuenta como |
| --------------------- | ------------------------------------------------- | ------------------------------------------------ | -------------- |
| `accepted`            | Pasó las cinco capas                              | Lo que decida el `action`                        | No se cuenta   |
| `discarded`           | El campo trampa llegó lleno                       | Lo mismo que un envío exitoso                    | `honeypot`     |
| `too_fast`            | Menos de 3 segundos desde que cargó el formulario | Un mensaje para intentar de nuevo                | `too_fast`     |
| `verification_failed` | Turnstile no validó o no respondió                | Un mensaje para intentar de nuevo                | `turnstile`    |
| `rate_limited`        | Pasó el límite por IP                             | Un mensaje para intentar más tarde               | `rate_limit`   |
| `invalid`             | Algún campo no cumple formato o longitud          | El error junto a cada campo, con lo que escribió | `validation`   |

Criterios:

- **Dado** un envío sin token de Turnstile, o con uno que Cloudflare rechaza, **cuando** se procesa, **entonces** el resultado es `verification_failed` y el `action` no recibe datos (AC-063).
- **Dado** que Cloudflare no responde en 5 segundos o responde con error, **cuando** se procesa, **entonces** el resultado es `verification_failed`. Nunca se acepta un envío sin verificación.
- **Dado** un envío con el campo trampa lleno, **cuando** se procesa, **entonces** el resultado es `discarded` y no se llama a Cloudflare ni se gasta cupo del límite por IP (AC-063).
- **Dado** un envío hecho 2 segundos después de pintar el formulario, **entonces** el resultado es `too_fast`. **Dado** uno hecho a los 4 segundos, **entonces** pasa esa capa (AC-063).
- **Dado** una marca de tiempo alterada, ausente o con más de 24 horas, **entonces** el resultado es `too_fast`.
- **Dado** 5 envíos aceptados del mismo formulario desde la misma IP en 10 minutos, **cuando** llega el sexto, **entonces** el resultado es `rate_limited` (AC-063). **Dado** que el sexto va a otro formulario, **entonces** no lo afecta el límite del primero.
- **Dado** un formulario que configura su propio límite y el modo `flag`, **cuando** se supera, **entonces** el resultado es `accepted` con la marca `overLimit: true`. Es lo que W15 necesita para FR-136.
- **Dado** un campo que excede su longitud máxima o no cumple su formato, **entonces** el resultado es `invalid` con el error de ese campo y los valores recibidos.
- **Dado** cualquier resultado distinto de `accepted`, **entonces** se suma 1 al contador de `form_rejections` de ese formulario y motivo, y no se guarda ningún dato del envío.
- **Dado** la IP del visitante, **entonces** nunca se guarda ni se escribe en un log en claro: se usa un hash con una sal que cambia cada día (UTC).
- **Dado** una petición con una cabecera `X-Forwarded-For` que el cliente rellenó con una IP falsa, **cuando** se calcula la IP, **entonces** se usa la que puso el proxy del hosting y no la del cliente.
- **Dado** el componente de protección dentro de un formulario, **entonces** el campo trampa no es visible, no recibe foco con el teclado y los lectores de pantalla lo ignoran.
- **Dado** el entorno `local` o `test`, **entonces** Turnstile usa las llaves de prueba que publica Cloudflare y ninguna prueba llama a la red.

Orden de las capas: trampa, tiempo, Turnstile, límite por IP, validación. Las dos primeras son gratis y van antes de llamar a un tercero.

## 6. Casos borde y estados de error

- **Base local apagada con pruebas de integración pedidas:** fallo ruidoso (RF-1). Un check verde que no corrió nada es peor que uno rojo.
- **Variable de entorno faltante en un despliegue:** el servidor no arranca y Railway conserva el despliegue anterior. El mensaje nombra la variable, nunca un valor.
- **Usuario de Auth sin correo:** el disparador de perfiles falla y la creación del usuario se revierte. No queda un usuario sin perfil.
- **Dos usuarios con el mismo correo en distinta capitalización:** `citext` más la clave única lo impiden.
- **Admin que se desactiva a sí mismo o al último admin:** fuera de W1. Lo decide W10a, que construye la pantalla de equipo.
- **Límite por IP a medianoche UTC:** la sal del hash cambia, así que la clave cambia y el conteo de esa IP empieza de nuevo. Se acepta: como mucho permite 10 envíos en vez de 5 en una ventana que cruza la medianoche.
- **Muchas personas detrás de la misma IP (un colegio, una red móvil):** el sexto envío en 10 minutos se rechaza con un mensaje claro, no en silencio. Es el comportamiento que pide FR-135; el Tour tiene su propia regla.
- **Persona real que envía en menos de 3 segundos (autocompletado):** recibe un mensaje para intentar de nuevo y conserva lo que escribió. No se le finge un éxito.
- **Turnstile caído:** nadie puede enviar formularios mientras dure. Se acepta porque FR-135 exige no guardar sin verificación. El mensaje ofrece WhatsApp y el correo como alternativa (los textos los pone cada formulario).
- **Formulario abierto por más de 24 horas:** la marca de tiempo venció; la persona recibe el mensaje de intentar de nuevo con un formulario fresco.
- **JavaScript desactivado:** Turnstile no puede validar, así que el envío falla con `verification_failed`. Se acepta.
- **Concurrencia en el límite:** `check_rate_limit` cuenta y decide en una sola sentencia con bloqueo de fila. El servidor no lee y luego escribe.
- **Concurrencia en las migraciones:** un solo carril a la vez (plan maestro). Dos PR con migración abiertos a la vez: el segundo lleva `blocked-by-N`.
- **Migración destructiva:** ninguna de W1 lo es. Como producción recibe las migraciones sola en cada merge, la revisión humana ocurre en el PR: todo ticket con migración lleva revisión de Camilo antes del merge (plan maestro, "Políticas RLS").
- **Migración que pasa en pruebas y falla en producción:** el workflow queda en rojo, Railway no despliega y los dos entornos siguen con el código anterior. `volleytip-dev` queda una migración adelante hasta que se corrija.
- **Imagen que no existe en el CDN:** el componente reserva su espacio igual; la página no salta. El contenido de reemplazo lo decide cada pantalla.
- **Ruta de la página de muestra en producción:** 404, no una redirección.

## 7. UX / UI

- **Mockups:** W1 no tiene pantalla propia. La referencia de los componentes es `design-system.md` (tabla "Core components" y "Mandatory component states"). Para comparar proporciones en contexto sirven `docs/mockups/Contacto.png` (campos y botón en zona oscura), `docs/mockups/Carrito--checkout.png` (campos en zona clara) y `docs/mockups/Main.png` (barra de anuncios, botones).
- **Página de muestra:** sin mockup: aplica `design-system.md`. Una sección por componente, cada estado con su nombre, repetida en zona oscura y en zona clara.
- **Viewports a soportar:** 360, 390, 768 y 1440 px.
- **Texto de los componentes:** llega por props. Los textos de ejemplo de la página de muestra son datos de prueba; W2 la excluye de la prueba de textos sin traducir.

## 8. Requerimientos no funcionales

- **Seguridad:** ninguna llave secreta en el navegador (NFR-003). La llave de servicio solo se importa desde módulos `*.server.ts`. RLS activado en toda tabla. Ningún log imprime un secreto ni una IP en claro.
- **Portabilidad:** nada exclusivo de Railway en el código (NFR-011). La configuración del despliegue puede vivir en Railway; el código solo lee variables con nombres propios.
- **Accesibilidad:** WCAG 2.2 AA. axe sin violaciones en la página de muestra. Zonas de toque de 44 px o más.
- **Rendimiento:** las imágenes reservan su espacio y cargan diferidas (FR-123, NFR-001). La verificación de Turnstile tiene un tope de 5 segundos.
- **Mantenibilidad:** TypeScript estricto, tipos de Supabase generados (NFR-010). Los tests del kit de la fábrica (`tests/unit/`) siguen en verde: dos tickets tocan `checks.yml`, que esos tests vigilan.
- **Dependencias nuevas de ejecución:** `@supabase/supabase-js` (cliente oficial; Supabase es el único backend) y una librería de validación de esquemas para la capa 5 de FR-135 (propuesta: `zod`). Cada PR las justifica en una línea.

## 9. Decisiones y preguntas abiertas

### Decididas por Camilo (11 de noviembre de 2026)

- **Hosting:** Railway, como dice el SRD. Pruebas y producción despliegan `main` solas con cada merge.
- **Supabase (cambiado el 17 de noviembre de 2026):** la organización `volleytip-web` empieza en el plan gratis con los dos proyectos, y pasa a Pro antes del lanzamiento L1. Mientras tanto un proyecto sin actividad se pausa (el workflow de migraciones sale en rojo hasta reactivarlo desde el panel) y no hay copias diarias. El plan gratis permite dos proyectos activos por cuenta: los de otras organizaciones de Camilo quedaron pausados. La decisión anterior, del 11 de noviembre, era una organización Pro con los dos proyectos (unos US$35 al mes: US$25 del plan, que cubre `volleytip-prod`, más unos US$10 de `volleytip-dev`). El SRD (BR-011, INT-001) contaba con `volleytip-dev` en el plan gratis.
- **Región:** US East para Supabase y Railway.
- **Docker:** opcional en la máquina de cada persona. Sin él, `npm test` salta las pruebas de base de datos y corren en el CI del PR.
- **React Router:** se actualiza a la 8 (ticket 1). La 8.5.1 pide Node 22.22 o más.

### Abiertas

Ninguna impide aprobar el PRD. Cada una trae la propuesta con la que se escribirán los tickets si no dices otra cosa.

- [x] **1. Qué enums crea W1.** Aprobada la propuesta el 17 de noviembre de 2026. El modelo de datos dice "todos los enums base". Propuesta: `user_role` y `publish_status`, que son los que comparten varias épicas. Cada épica crea los demás junto con sus tablas, para no dejar tipos sin uso. (Camilo)
- [x] **2. FR-076, separar tablas de la web y compartidas.** Aprobada la propuesta el 17 de noviembre de 2026. Propuesta: un solo esquema `public` y un comentario de ámbito por tabla que una prueba exige (RF-8). La alternativa, dos esquemas de Postgres, obliga a exponer el segundo en la API y complica cada consulta. (Camilo)
- [ ] **3. Cuentas que solo tú puedes crear.** La organización de Supabase con `volleytip-dev` y `volleytip-prod` (creados el 17 de noviembre de 2026), el proyecto de Railway, la zona de Bunny con Optimizer y el sitio de Turnstile en Cloudflare. Los tickets marcados "Acompañado" empiezan por ahí. El plugin de Supabase de Claude Code todavía no ve la organización `volleytip-web`: hay que reconectarlo a esa cuenta. (Camilo)
- [x] **4. NFR-009 sin dueño.** Aprobada la propuesta el 17 de noviembre de 2026. Copias diarias, restauración probada y monitoreo no están en ninguna épica. Propuesta: las copias las da el plan Pro, que se contrata antes del lanzamiento L1; la restauración probada y el monitoreo entran a la lista de verificación de W13 (#8). (Camilo)
- [ ] **5. "Wait for CI" de Railway.** Hay que comprobar en el ticket 12 que Railway espera también al workflow de migraciones y no solo a `checks`. Si no, el despliegue lo dispara el propio workflow al terminar. (Se comprueba al construir)
- [ ] **6. Cabecera de IP en Railway.** Hay que comprobar en el entorno de pruebas qué cabecera pone el proxy de Railway y cuántos saltos hay, para que la IP no la pueda falsear el cliente. Se resuelve dentro del ticket 15. (Se comprueba al construir)
- [ ] **7. P-18.** Confirmar que el plan Hobby de Railway permite este uso. No bloquea W1; bloquea el lanzamiento (W13). (Camilo)

## 10. Descomposición en tickets (para write-ticket)

Los 17 tickets cuelgan de la épica #1. Como W1 se hace acompañada, la propuesta es crearlos **sin `ready-for-dev`** y decidir en la tabla de revisión de `write-ticket` cuáles llevan `pending`. "Acompañado" marca los que necesitan que Camilo cree o entregue algo.

Carril de migraciones: los tickets 5, 6 y 7 van uno tras otro, nunca en paralelo.

Creados el 17 de noviembre de 2026 como #20 a #36, en el mismo orden de la tabla (el ticket 1 es el #20 y el 17 es el #36). Los seis acompañados (#20, #23, #29, #31, #34 y #36) nacieron sin `pending` y con su tarjeta en `Blocked`: entran a la cola cuando Camilo mueve la tarjeta a `Todo`. Dos tickets recibieron un bloqueo más que el de la tabla: #25 y #28 esperan también al #22, porque usan los clientes de Supabase que ese ticket crea.

| #   | Título propuesto                                                                                                     | RF          | Tamaño | Depende de   | Acompañado                                                        | Auto-merge sugerido                                        |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Actualizar React Router a la versión 8 y fijar la versión mínima de Node                                             | CON-001     | S      | ninguna      | **Sí**: Node 22.22 o más en tu máquina                            | No: cambia el framework de toda la app                     |
| 2   | Agregar Supabase CLI, base local y pruebas de integración al repo y al CI                                            | RF-1        | M      | 1            | No                                                                | No: cambia `checks.yml`, que decide qué corre en cada PR   |
| 3   | Validar las variables de entorno y crear los clientes de Supabase del servidor                                       | RF-2        | M      | 2            | No                                                                | No: es por donde pasan todos los secretos                  |
| 4   | Crear `volleytip-dev` y `volleytip-prod` y documentar sus variables                                                  | RF-3, RF-10 | S      | ninguna      | **Sí**: crea la organización, los proyectos y guarda los secretos | No: lo ejecuta una persona                                 |
| 5   | Crear `profiles` con rol, disparador de alta y políticas RLS                                                         | RF-4        | M      | 2            | No                                                                | No: permisos (RLS)                                         |
| 6   | Crear `settings` y `audit_log` de solo inserción, con sus lectores de servidor                                       | RF-5, RF-6  | M      | 5            | No                                                                | No: permisos (RLS)                                         |
| 7   | Crear `rate_limits` y `form_rejections` con `check_rate_limit` y su limpieza diaria                                  | RF-7        | M      | 6            | No                                                                | No: permisos (RLS) y lógica nueva                          |
| 8   | Hacer fallar el CI ante una tabla sin RLS o sin comentario de ámbito                                                 | RF-8        | S      | 5            | No                                                                | No: es el guardia de permisos de todas las épicas          |
| 9   | Generar los tipos de la base de datos y hacer fallar el CI si quedan viejos                                          | RF-9        | S      | 5            | No                                                                | No: cambia `checks.yml`                                    |
| 10  | Aplicar las migraciones a pruebas y a producción en cada merge a `main`                                              | RF-3        | M      | 4, 5         | **Sí**: secretos del repo                                         | No: escribe en la base de producción                       |
| 11  | Marcar las respuestas fuera de producción como no indexables y exponer el entorno en `/healthz`                      | RF-10       | S      | 3            | No                                                                | Sí: mecánico y cubierto por pruebas, sin datos ni permisos |
| 12  | Desplegar pruebas y producción en Railway con cada merge a `main`                                                    | RF-10       | M      | 3, 4, 10, 11 | **Sí**: cuenta de Railway, DNS de `staging`                       | No: lo ejecuta una persona                                 |
| 13  | Construir la página de muestra con botones, eyebrow y barra de anuncios                                              | RF-12       | M      | 3            | No                                                                | No: fija la línea base visual de todo el sitio             |
| 14  | Construir el campo de texto con etiqueta y estados de error                                                          | RF-12       | M      | 13           | No                                                                | No: fija la línea base visual de los formularios           |
| 15  | Construir las piezas de la protección de formularios: trampa, tiempo firmado, hash de IP y verificación de Turnstile | RF-14       | M      | 3            | **Sí**: sitio de Turnstile y cabecera de IP en Railway            | No: seguridad                                              |
| 16  | Unir las cinco capas en la utilidad de formularios protegidos y su componente                                        | RF-14       | M      | 7, 14, 15    | No                                                                | No: seguridad                                              |
| 17  | Construir el constructor de URL y el componente de imagen optimizada                                                 | RF-13       | M      | 3            | **Sí**: zona de Bunny con Optimizer                               | No: la comprobación final es manual contra el CDN          |

El ticket 17 se puede adelantar a cualquier momento después del 3, porque no comparte archivos con los demás.

Orden sugerido de trabajo: 1 y 4 primero (el 4 lo haces tú mientras el 1 avanza). Después 2, 3 y 5. Luego dos carriles: base de datos (6, 7, 8, 9, 10) e interfaz (13, 14). El 11 y el 12 dejan los dos entornos arriba en cuanto existan 3, 4 y 10. Al final 15, 16 y 17.

Sugerencia de `ui-review`: tickets 13 y 14. Son los únicos donde importa el juicio visual, y lo que fijen lo heredan todas las pantallas.

Skill que falta: no hay una skill de prácticas de Supabase propia del proyecto (migraciones, RLS, pruebas de políticas, funciones con bloqueo). Existen las del plugin de Supabase, que son generales. Conviene escribir `supabase-practices` con las reglas de este repo al cerrar el ticket 5, cuando ya haya un ejemplo real que citar.
