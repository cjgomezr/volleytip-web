# Entornos y variables

Qué entornos tiene volleytip.com, qué variables necesita cada uno, dónde se obtiene cada valor y dónde se pone. Este documento solo lleva **nombres**. Ningún valor real (llaves, contraseñas, URLs de proyecto) se escribe aquí ni en ningún otro archivo del repo.

Lo abrió el ticket #23. Lo completan #29 (secretos del workflow de migraciones), #31 (Railway), #34 (Turnstile y protección de formularios), #36 (imágenes) y #152 (Bunny Stream).

## Entornos

| Entorno    | `APP_ENV`    | Dónde corre                                   | Base de datos                         |
| ---------- | ------------ | --------------------------------------------- | ------------------------------------- |
| Local      | `local`      | La máquina de cada persona (`npm run dev`)    | Base local de Supabase CLI (#21)      |
| Pruebas    | `test`       | Vitest y Playwright, en la máquina y en el CI | Base local de Supabase CLI            |
| Staging    | `staging`    | Railway, `staging.volleytip.com`              | Proyecto `volleytip-dev` de Supabase  |
| Producción | `production` | Railway. Recibe `volleytip.com` en W13        | Proyecto `volleytip-prod` de Supabase |

Las pruebas nunca apuntan a `volleytip-dev` ni a `volleytip-prod`.

## Supabase

Los dos proyectos viven en la organización `volleytip-web`, en la región US East.

### Variables de la aplicación

Los nombres los fija el ticket #22, que crea el módulo que las valida (`src/lib/env.server.ts`).

| Variable                    | Qué es                                                       | Dónde se obtiene                                         |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `APP_ENV`                   | Nombre del entorno: `local`, `test`, `staging`, `production` | Se escribe a mano según la tabla de arriba               |
| `SUPABASE_URL`              | URL del proyecto                                             | Panel de Supabase, proyecto, sección de la API           |
| `SUPABASE_ANON_KEY`         | Llave pública. Respeta RLS                                   | Panel de Supabase, proyecto, sección de llaves de la API |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio. Salta RLS. Solo vive en el servidor       | Panel de Supabase, proyecto, sección de llaves de la API |

Si el panel muestra las llaves con los nombres nuevos, la "publishable" va en `SUPABASE_ANON_KEY` y la "secret" va en `SUPABASE_SERVICE_ROLE_KEY`.

### Dónde se pone cada valor

| Entorno    | Dónde se ponen                                                 | De qué proyecto salen                           |
| ---------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Local      | `.env.local` en la raíz del repo. Git lo ignora; nunca se sube | De la base local: los imprime `supabase status` |
| Pruebas    | Las pone la propia corrida: `tests/support/test-env.ts`        | URL de la base local; las llaves son marcadores |
| Staging    | Variables del servicio `staging` en Railway                    | `volleytip-dev`                                 |
| Producción | Variables del servicio `production` en Railway                 | `volleytip-prod`                                |

Ninguna llave se comparte entre staging y producción. `.env.example` lista los mismos nombres sin valores.

### Cómo se validan

`src/lib/env.server.ts` valida todas las variables cuando el servidor carga. Si falta alguna, está vacía o `APP_ENV` no es uno de los cuatro valores, el servidor no arranca y el mensaje nombra cada variable con problema. Nunca imprime un valor.

- **En local:** `npm run dev` lee `.env.local`. Sin ese archivo, el servidor de desarrollo falla al arrancar. Se crea copiando `.env.example` y llenando los valores de la base local (`npm run db:start` y luego `npx supabase status`).
- **En pruebas:** Vitest y el servidor que levanta Playwright reciben `APP_ENV=test` desde `tests/support/test-env.ts`. No dependen del `.env.local` de nadie.
- **En Railway:** las variables del servicio. `npm run start` no lee ningún archivo `.env`.

### Lo que se guarda fuera del repo

De **cada** proyecto, en el gestor de contraseñas de Camilo:

- La URL del proyecto.
- La llave pública.
- La llave de servicio.
- La contraseña de la base de datos. Supabase no la vuelve a mostrar; si se pierde, se restablece desde el panel.
- El identificador del proyecto (Project ID o "ref").

La contraseña y el identificador no los usa la aplicación. Los usa el workflow de migraciones (#29) como secretos de GitHub.

### Opciones con las que se crearon los proyectos

Los dos se crearon el 17 de noviembre de 2026 con estas opciones marcadas:

- **Data API activada.** Es la API que usa `@supabase/supabase-js`.
- **Exponer las tablas nuevas automáticamente.** La barrera de acceso es RLS, no los permisos de tabla: una tabla con RLS y sin políticas devuelve cero filas.
- **RLS automático en tablas nuevas.** Es una segunda red. Las migraciones igual activan RLS de forma explícita, porque la base local no tiene esta opción.

### Plan gratis durante el desarrollo

La organización está en el plan gratis hasta poco antes del lanzamiento L1. Mientras tanto:

- **Un proyecto sin actividad se pausa** después de cerca de una semana. El workflow de migraciones (#29) sale en rojo contra un proyecto pausado. Se reactiva desde el panel de Supabase, en la página del proyecto.
- **No hay copias de seguridad diarias.** Se acepta mientras no haya datos reales.
- **El plan gratis permite dos proyectos activos por cuenta.** Los proyectos de otras organizaciones de la misma cuenta quedaron pausados para liberar el cupo.

Pasar la organización a Pro es requisito del lanzamiento L1 y está en la lista de pendientes del plan maestro (W13, #8).

## Secretos del workflow de migraciones

`.github/workflows/migrations.yml` aplica las migraciones de `supabase/migrations/` en cada merge a `main`: primero a `volleytip-dev` y, si sale bien, a `volleytip-prod`. Necesita cinco secretos del repositorio.

| Secreto                     | Qué es                                                      | Dónde se obtiene                                                            |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`     | Token personal de la cuenta de Supabase. Sirve para los dos | Panel de Supabase, menú de la cuenta, Access Tokens, generar uno nuevo      |
| `SUPABASE_DEV_PROJECT_REF`  | Identificador (Project ID) de `volleytip-dev`               | Panel de Supabase, proyecto `volleytip-dev`, Project Settings, General      |
| `SUPABASE_DEV_DB_PASSWORD`  | Contraseña de la base de `volleytip-dev`                    | El gestor de contraseñas. Si se perdió, se restablece en Database, Settings |
| `SUPABASE_PROD_PROJECT_REF` | Identificador (Project ID) de `volleytip-prod`              | Panel de Supabase, proyecto `volleytip-prod`, Project Settings, General     |
| `SUPABASE_PROD_DB_PASSWORD` | Contraseña de la base de `volleytip-prod`                   | El gestor de contraseñas. Si se perdió, se restablece en Database, Settings |

**Dónde se ponen:** en GitHub, en el repositorio: Settings, Secrets and variables, Actions, pestaña Secrets, botón "New repository secret". Uno por cada fila, con el nombre exacto. También sirve `gh secret set NOMBRE` desde la terminal, que pide el valor sin mostrarlo.

Cosas que conviene saber:

- **El token se muestra una sola vez.** Si se pierde, se genera otro y se reemplaza el secreto. Si se le pone fecha de vencimiento, el workflow sale en rojo cuando venza.
- **Restablecer la contraseña de una base obliga a actualizar su secreto.**
- **Si falta un secreto**, el workflow falla en su primer paso, antes de tocar ninguna base, y dice cuál falta. Nunca imprime un valor.
- **GitHub no deja leer un secreto ya guardado.** Solo se puede reemplazar.
- **Un proyecto pausado** (plan gratis, ver arriba) hace fallar la corrida. Se reactiva desde el panel y se vuelve a lanzar la corrida desde la pestaña Actions.

Una migración que falla no queda aplicada a medias: cada archivo corre en una transacción. Para que eso se cumpla, una migración nunca lleva `begin`, `commit` ni `rollback` propios; una prueba lo vigila. Si una migración sale mal, se corrige con otra migración.

## Railway

El sitio corre en Railway, en un proyecto llamado `volleytip-web`. Lo montó el ticket #31 el 19 de noviembre de 2026.

### Cómo está organizado

Railway agrupa los servicios en "environments". Aquí hay uno solo, `volleytip`, y es solo una carpeta: no es ni staging ni producción. Adentro viven los dos servicios, que despliegan el mismo repositorio:

| Servicio     | `APP_ENV`    | Dirección                                     | Base de datos    |
| ------------ | ------------ | --------------------------------------------- | ---------------- |
| `staging`    | `staging`    | `https://staging.volleytip.com`               | `volleytip-dev`  |
| `production` | `production` | `https://production-volleytip.up.railway.app` | `volleytip-prod` |

El servicio `staging` también responde en `volleytip-web-staging.up.railway.app`, la dirección que le generó Railway. La de `production` es provisional: recibe `volleytip.com` en W13 (#8).

Para saber a qué entorno apunta un servicio, se abre su dirección con `/healthz` al final. La respuesta dice `environment`.

### Variables de cada servicio

Se ponen en la pestaña Variables del servicio. Ninguna llave ni secreto se repite entre los dos.

| Variable                    | Servicio `staging`              | Servicio `production`                         |
| --------------------------- | ------------------------------- | --------------------------------------------- |
| `APP_ENV`                   | `staging`                       | `production`                                  |
| `SUPABASE_URL`              | De `volleytip-dev`              | De `volleytip-prod`                           |
| `SUPABASE_ANON_KEY`         | De `volleytip-dev`              | De `volleytip-prod`                           |
| `SUPABASE_SERVICE_ROLE_KEY` | De `volleytip-dev`              | De `volleytip-prod`                           |
| `TURNSTILE_SITE_KEY`        | Del widget de staging           | Del widget de producción                      |
| `TURNSTILE_SECRET_KEY`      | Del widget de staging           | Del widget de producción                      |
| `FORM_PROTECTION_SECRET`    | Generado para staging           | Generado para producción                      |
| `CLIENT_IP_HEADER`          | `X-Real-IP`                     | El mismo que staging                          |
| `CLIENT_IP_TRUSTED_HOPS`    | `1`                             | El mismo que staging                          |
| `IMAGE_CDN_HOST`            | Dominio de la zona de Bunny     | El mismo que staging                          |
| `SITE_ORIGIN`               | `https://staging.volleytip.com` | `https://production-volleytip.up.railway.app` |
| `BUNNY_STREAM_LIBRARY_ID`   | De la librería de pruebas       | De la librería real                           |
| `BUNNY_STREAM_API_KEY`      | De la librería de pruebas       | De la librería real                           |
| `BUNNY_STREAM_CDN_HOST`     | De la librería de pruebas       | De la librería real                           |

De dónde sale cada valor está arriba, en "Variables de la aplicación", y abajo, en "Protección de formularios", "Imágenes", "Videos (Bunny Stream)" y "Dirección pública del sitio".

- **`SUPABASE_SERVICE_ROLE_KEY` va sellada** (menú de la variable, Seal). Sellada no se puede leer desde el panel ni desde la API de Railway; el servidor la recibe igual. No se puede quitar el sello: para cambiarla se reemplaza el valor. El original sigue en el gestor de contraseñas.
- **`TURNSTILE_SECRET_KEY`, `FORM_PROTECTION_SECRET` y `BUNNY_STREAM_API_KEY` también van selladas.**
- **`PORT` no se pone.** Railway la define sola y `npm run start` la lee.
- **Si falta una variable, el servidor no arranca.** El despliegue falla y el registro nombra la variable, sin imprimir ningún valor.

### Ajustes de cada servicio

Los dos servicios llevan los mismos, en la pestaña Settings:

- **Rama:** `main`.
- **Wait for CI:** activado. Railway espera a que los workflows de GitHub del commit terminen en verde antes de desplegar.
- **Región:** US East, la misma de Supabase.
- **Healthcheck Path:** `/healthz`. Railway no pasa el tráfico al despliegue nuevo hasta que esa ruta responde.
- **Comandos:** los que detecta, `npm run build` y `npm run start`. La versión de Node sale de `.nvmrc`.

No hay ningún archivo de configuración de Railway en el repo. El código solo lee las variables de arriba (NFR-011).

### Cómo se despliega

Nadie despliega a mano. Cada merge a `main` despliega los dos servicios, staging y producción, en cuanto los workflows del commit terminan en verde. Si un workflow falla, Railway no despliega ese commit y sigue sirviendo el anterior; así lo documenta Railway, y aquí todavía no se ha visto (ver abajo).

**Comprobado el 19 de noviembre de 2026:** Railway espera a todos los workflows del commit, no solo a `checks`. En el merge del PR #48, `checks` terminó a las 10:05:20 UTC y el workflow de migraciones a las 10:06:15. Los dos servicios quedaron en "Waiting for CI" y la construcción de `staging` empezó a las 10:06:27. Eso responde la pregunta abierta 5 del PRD: el código nuevo no llega antes que su migración.

**Sin comprobar todavía:** que un workflow en rojo frene el despliegue, y que con una variable borrada Railway conserve el despliegue anterior. Camilo decidió dejar esas pruebas para después. Lo primero es el comportamiento documentado de "Wait for CI"; lo segundo se apoya en la ruta de salud, que impide pasar el tráfico a un servidor que no arrancó.

Producción no tiene un paso de aprobación manual. Si gana uno se decide en W13.

Para volver a un despliegue anterior: pestaña Deployments del servicio, menú del despliegue, Redeploy. Eso no deshace una migración; una migración que salió mal se corrige con otra.

### El dominio de staging

`staging.volleytip.com` se agregó como Custom Domain en el servicio `staging`. Railway pidió dos registros, que se crearon en Namecheap (Advanced DNS de `volleytip.com`):

- Un CNAME con host `staging`.
- Un TXT de verificación con host `_railway-verify.staging`.

Los valores los muestra Railway en Settings, Networking, "Show DNS records". El certificado lo emite y lo renueva Railway.

### Plan

La cuenta está en el periodo de prueba. Ese plan permite un solo dominio propio, que ya usa `staging`. Antes de W13 hace falta un plan que permita el dominio de producción. Confirmar que el plan Hobby alcanza para este uso es la pregunta P-18 del PRD, que sigue abierta: no bloquea W1, bloquea el lanzamiento.

## Protección de formularios

Todo formulario público pasa por cinco capas (FR-135). Cuatro necesitan configuración, y son estas cinco variables. Las piezas viven en `src/lib/forms/` y las construyó el ticket #34.

| Variable                 | Qué es                                                                                     | Dónde se obtiene                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `TURNSTILE_SITE_KEY`     | Llave pública del widget de Turnstile. Llega al navegador                                  | Panel de Cloudflare, Turnstile, el widget del entorno |
| `TURNSTILE_SECRET_KEY`   | Llave secreta del mismo widget. Con ella el servidor le pregunta a Cloudflare              | Panel de Cloudflare, Turnstile, el widget del entorno |
| `FORM_PROTECTION_SECRET` | Secreto propio. Firma la marca de tiempo de los formularios y deriva la sal del hash de IP | Se genera al azar. No sale de ningún servicio         |
| `CLIENT_IP_HEADER`       | Nombre de la cabecera donde el proxy del hosting anota la IP del visitante                 | Se mide en el entorno, con `/dev/cabeceras`           |
| `CLIENT_IP_TRUSTED_HOPS` | Cuántos proxies de confianza anotan en esa cabecera. Un entero, 1 o más                    | Se mide en el entorno, con `/dev/cabeceras`           |

### Turnstile

- **Un widget por entorno.** En Cloudflare se crean dos: uno para staging, con el dominio `staging.volleytip.com`, y otro para producción, con `volleytip.com` y la dirección provisional de Railway. Así ninguna llave se comparte.
- **En local y en pruebas van las llaves de prueba que publica Cloudflare.** Son públicas, siempre pasan y sirven en cualquier dominio. Están en `src/lib/forms/turnstile-test-keys.ts`, con el enlace a la página de Cloudflare de donde salen. Con ellas la verificación no llama a la red.
- **En local no sirven las llaves reales.** Con `APP_ENV` en `local` o `test` la verificación no llama a Cloudflare y solo acepta la llave secreta de prueba. Con una llave real en `.env.local`, todos los envíos fallan.
- **Las llaves de prueba no sirven en staging ni en producción.** El servidor no arranca si las encuentra ahí: dejarían los formularios sin protección.
- **Si Cloudflare no responde en 5 segundos o responde algo raro, el envío no pasa.** Nunca se acepta sin verificación.

### El secreto de formularios

`FORM_PROTECTION_SECRET` debe tener 32 caracteres o más y ser distinto en cada entorno. Se genera en la terminal de quien lo va a guardar:

```
node -e "console.log(require(crypto).randomBytes(32).toString(base64url))"
```

Se guarda en el gestor de contraseñas y se pega en Railway. No se escribe en ningún archivo del repo ni en un chat.

Cambiarlo no rompe datos. Las marcas de tiempo de los formularios que estaban abiertos dejan de valer y esas personas tienen que recargar. Los hashes de IP del día cambian, así que el conteo del límite de envíos de ese día vuelve a empezar.

### Cómo se protege un formulario

Las piezas se usan juntas por `src/lib/forms/protected-form.server.ts` (#35). Un formulario público hace tres cosas:

1. Se define una vez con `defineProtectedForm({ id, schema })`, en un módulo `*.server.ts`. El `id` es el nombre con el que aparece en `form_rejections`. El esquema de `zod` fija formato y longitud de cada campo, y sus mensajes son los que ve la persona.
2. El `loader` llama a `issueFormProtection(form)` y la página pasa el resultado a `<FormProtection>`, dentro del `<Form>`.
3. El `action` llama a `processProtectedForm(request, form)`. Los datos solo existen cuando el resultado es `accepted`.

Cosas que conviene saber:

- **El límite cuenta intentos, no envíos aceptados.** Todo envío que pasa Turnstile gasta cupo, también el que después falla la validación. Con el límite por defecto, quien se equivoca cinco veces en diez minutos tiene que esperar.
- **Cada respuesta del servidor trae una marca de tiempo nueva.** Quien corrige un error y reenvía en menos de 3 segundos recibe `too_fast`.
- **En `local` y `test` no hay proxy**, así que no llega la cabecera de IP: todos los envíos cuentan como de la propia máquina. En `staging` y `production`, si la cabecera falta el envío falla con un error, porque el entorno está mal configurado.
- **Los envíos solo se aceptan desde los dominios propios.** React Router compara el origen que manda el navegador con la dirección de la petición, y detrás del proxy de Railway nunca coinciden: el proxy termina el HTTPS y el servidor ve la petición por http. La lista de dominios aceptados está en `allowedActionOrigins`, en `react-router.config.ts`: `volleytip.com`, `www.volleytip.com`, `staging.volleytip.com` y la dirección provisional de producción, `production-volleytip.up.railway.app`, que sale de la lista cuando producción reciba `volleytip.com` (W13). Un dominio nuevo se agrega ahí; sin eso, todo envío desde él responde 400. La otra dirección de staging, `volleytip-web-staging.up.railway.app`, no está en la lista: los formularios de staging se prueban en `staging.volleytip.com`.
- **El tamaño del cuerpo no lo limita esta función.** El servidor lee el envío completo antes de la primera capa. El tope de tamaño de una petición lo pone el hosting.
- **Para verlo funcionar**: el formulario de ejemplo de `/dev/componentes` muestra el resultado que devuelve el servidor. En producción esa página no existe.

### La IP del visitante

El servidor no ve la conexión del visitante: la ve el proxy de Railway, que la anota en una cabecera. Si se lee la cabecera equivocada, un visitante puede escribir en ella la IP que quiera y saltarse el límite de envíos. Por eso la cabecera y el número de saltos son configuración y no van escritos en el código.

- **Cómo se lee.** El valor de la cabecera se divide por comas y se toma la entrada número `CLIENT_IP_TRUSTED_HOPS` contando desde la derecha. Con 1 es la última. Lo que el visitante haya escrito queda a la izquierda y no se lee.
- **Si no hay una IP utilizable, es un error.** No hay IP por defecto: todos los visitantes compartirían el mismo límite.
- **La IP no se guarda.** Solo se guarda su hash, con una sal que cambia cada día (UTC). Ninguna pieza la escribe en un registro.

**Medido en Railway el 2026-11-20 (#34):** `CLIENT_IP_HEADER` es `X-Real-IP` y `CLIENT_IP_TRUSTED_HOPS` es `1`. Se midió con `https://staging.volleytip.com/dev/cabeceras`, una ruta de diagnóstico que devuelve solo las cabeceras de proxy de la propia petición y que en producción responde 404.

- Railway escribe `X-Real-IP` con la dirección del visitante. Una petición que traía su propio `X-Real-IP` llegó con el valor de Railway, no con el del cliente.
- `X-Forwarded-For` llega con dos entradas: el visitante y, a su derecha, un servidor intermedio de Railway cuya dirección cambia entre peticiones. Railway también descarta lo que el cliente escriba ahí. Con 1 salto esa cabecera daría la dirección de Railway, no la del visitante; por eso no se usa.
- Si algún día se pone otro proxy delante de Railway (por ejemplo Cloudflare), hay que medir de nuevo: `X-Real-IP` pasaría a ser la dirección de ese proxy.

**Un arranque fallido tumba el servicio.** El 2026-11-20, tras el merge del #34, el despliegue de los dos servicios quedó en CRASHED y Railway ya había retirado la versión anterior: respondieron 502 hasta que se volvió a desplegar a mano, sin cambiar nada. La causa de esa caída no se investigó. No hay que contar con que Railway conserve la versión anterior. Se revisa junto a las pruebas de fallo de Railway pendientes para W13.

### Dónde se pone cada valor

| Entorno    | Llaves de Turnstile                | `FORM_PROTECTION_SECRET`               | Cabecera de IP                     |
| ---------- | ---------------------------------- | -------------------------------------- | ---------------------------------- |
| Local      | Las de prueba, en `.env.local`     | Cualquier texto de 32 caracteres o más | Cualquier nombre de cabecera y `1` |
| Pruebas    | Las de prueba, las pone la corrida | Lo pone la corrida                     | Lo pone la corrida                 |
| Staging    | Las del widget de staging          | Generado, sellado en Railway           | Lo que se mida en Railway          |
| Producción | Las del widget de producción       | Generado, sellado en Railway           | Lo que se mida en Railway          |

En local no hay proxy delante, así que la cabecera de IP no llega y la IP del visitante sale como error. Qué hace un formulario con ese error lo decide el ticket #35.

## Acceso al panel

El panel (`/admin` y `/en/admin`) usa una sesión de Supabase Auth guardada en cookies `HttpOnly`, `SameSite=Lax` y `Secure` fuera de `local` y `test`. La única variable propia es opcional: `GOOGLE_SIGN_IN_ENABLED` (ver "Entrar con Google").

- **El registro público va apagado en cada proyecto.** En local lo hace `enable_signup = false` en `supabase/config.toml`. En los proyectos alojados ese archivo no se aplica solo: se apaga a mano en el panel de Supabase, en Authentication → Sign In / Providers → "Allow new users to sign up".
- **Las cuentas las crea el servidor** con la llave de servicio, nunca el navegador.
- **Los envíos del panel solo se aceptan desde `SITE_ORIGIN`.** Es más estricto que los formularios públicos: desde otro dominio propio (`www.volleytip.com` cuando `SITE_ORIGIN` es `volleytip.com`) un envío responde 403, y desde un dominio ajeno React Router responde 400 antes. El panel de staging se usa en `staging.volleytip.com`. En `local` y `test` también se acepta la dirección donde corre el servidor.
- **El panel responde en modo mantenimiento.** Es desde donde se apaga.
- **En las pruebas** se entra sin correo: `createTestSession` (`src/testing/local-session.ts`) para las de integración y `signInToPanel` (`tests/support/panel-session.ts`) para Playwright. Las dos solo sirven contra la base local.

### El correo para entrar

La persona escribe su correo en `/admin/entrar` y Supabase Auth le manda un enlace de un solo uso que vence en una hora. El enlace abre el sitio (`/admin/entrar/enlace`), que no canjea nada hasta que la persona pulsa "Entrar".

**En local** no hay nada que configurar. `supabase/config.toml` declara la plantilla y el correo llega al buzón de pruebas (`http://127.0.0.1:54324`). Después de cambiar `config.toml` o la plantilla hay que reiniciar la base (`npm run db:stop` y `npm run db:start`). El enlace local apunta a `http://localhost:3740`.

**En cada proyecto alojado** (`volleytip-dev` y `volleytip-prod`) lo hace Camilo en el panel de Supabase, porque ese archivo no se aplica solo. Los nombres de los menús pueden cambiar un poco entre versiones del panel.

1. **Site URL.** Authentication → URL Configuration → "Site URL": el mismo valor que `SITE_ORIGIN` del servicio de Railway de ese entorno (`https://staging.volleytip.com` en `volleytip-dev`). El enlace del correo se arma con él. Cuando cambie el dominio de producción (W13) hay que cambiarlo aquí también.
2. **Redirect URLs** (las direcciones de retorno). En la misma pantalla, "Redirect URLs" → "Add URL": el mismo origen seguido de `/**`, por ejemplo `https://staging.volleytip.com/**`. Sin esto Supabase cambia la dirección de retorno por la Site URL y, al entrar, siempre se llega al inicio del panel.
3. **SMTP de Resend.** Authentication → Emails → "SMTP Settings" → activar "Enable custom SMTP":
   - Host: `smtp.resend.com`. Puerto: `465`.
   - Usuario: `resend`.
   - Contraseña: una llave de API de Resend con permiso solo de envío (Resend → API Keys), una por entorno. Se guarda en el gestor de contraseñas; nunca en el repositorio.
   - Sender email: una dirección del dominio verificado en Resend. Sender name: `VolleyTip`.
4. **Límite de correos.** Authentication → Rate Limits → "emails per hour": comprobar que alcanza para el equipo (Supabase pone un tope bajo al activar el SMTP propio).
5. **Plantilla.** Authentication → Emails → "Templates" → "Magic Link":
   - Subject: `Tu enlace para entrar a VolleyTip / Your VolleyTip sign-in link`.
   - Body: pegar completo el contenido de `supabase/templates/magic_link.html`.
   - Cada vez que ese archivo cambie en el repositorio hay que pegarlo de nuevo en los dos proyectos.
6. **Vencimiento.** Authentication → Sign In / Providers → Email: "Email OTP Expiration" en `3600` segundos, que es lo que dice el correo.
7. **Registro público apagado.** Authentication → Sign In / Providers → "Allow new users to sign up": desactivado.
8. **Comprobar.** Con un admin ya creado (ver abajo), pedir el enlace en el sitio del entorno, abrir el correo y entrar. Probar también con un correo ajeno: la pantalla responde igual y no llega nada.

Una cuenta del equipo tiene que tener el correo confirmado (el comando de abajo lo deja así): con el registro apagado, a una sin confirmar no le llega el enlace.

**Si el correo no llega.** La pantalla responde "revisa tu correo" aunque el envío falle, para no delatar quién es del equipo. El fallo queda en el registro del servidor ("Supabase Auth no envió el enlace de entrada", con su estado) y en el panel de Supabase, en Logs → Auth. Solo cuando Supabase Auth no responde la pantalla dice que no se pudo enviar.

### El primer admin de cada entorno

Un entorno recién creado no tiene a nadie que pueda entrar al panel. El primer admin se crea con un comando, una vez por entorno (#121):

```
npm run admin:create -- <correo>
```

Si el correo no tiene cuenta, la crea con el correo confirmado y la deja como `admin` activo. Si ya tiene una (comprador, staff o admin desactivado), la sube a `admin` activo sin crear otra. Si ya es admin activo, lo dice y no cambia nada. Cada cambio deja una entrada `profile.grant_admin` en `audit_log`, sin actor.

- **Una cuenta que ya existía** recibe, al subir a admin, una contraseña al azar que nadie conoce. Si alguien más la había creado con ese correo, no puede entrar con su contraseña. Al panel se entra con el enlace o con Google. El cambio de contraseña impide renovar las sesiones que esa cuenta tuviera abiertas, pero un token de acceso ya emitido vale hasta que vence (una hora): si la cuenta no la creaste tú, bórrala primero en el panel de Supabase (Authentication, Users) y deja que el comando la cree de nuevo.
- **Una cuenta que nunca confirmó su correo** queda además confirmada, aunque ya fuera admin activo: sin confirmar no podría pedir el enlace. Es el único caso en que el comando cambia algo de un admin activo.
- **Si el comando falla**, dice en qué quedó todo y se repite. La entrada de la bitácora se escribe antes del cambio, así que un fallo a la mitad puede dejar una entrada de más, nunca un admin sin registro.

El comando solo necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Las toma de la terminal y, las que falten ahí, de `.env.local`. Antes de escribir muestra a qué proyecto apunta y pide su identificador: en un proyecto alojado es el Project ID (el subdominio de la URL); en local, el host con su puerto, como `127.0.0.1:54321`. Con otra respuesta no escribe nada. Hay que leerlo: es la última defensa contra escribir en el proyecto equivocado.

**En local.** Con la base arriba (`npm run db:start`) y `.env.local` lleno, basta el comando.

**En pruebas (`volleytip-dev`) y en producción (`volleytip-prod`).** Desde la raíz del repo, en Git Bash, una línea a la vez (si se pegan juntas, `read` toma la segunda como si fuera la llave):

```
read -rsp "Llave de servicio: " SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL="https://<identificador>.supabase.co" npm run admin:create -- <correo>
unset SUPABASE_SERVICE_ROLE_KEY
```

- La URL y la llave de servicio salen del gestor de contraseñas, las del proyecto al que se va a escribir.
- `read -s` pide la llave sin mostrarla y la deja fuera del historial de la terminal. No se escribe en el comando, ni en `.env.local`, ni en otro archivo.
- Las dos variables se ponen siempre juntas. Si falta una, el comando toma la de `.env.local`, que es la de la base local.
- El `unset` final no es opcional: mientras la llave siga en la terminal, cualquier otro comando de esa sesión la ve.

El correo se escribe solo en la terminal. Ningún correo del equipo va al repo.

### Entrar con Google

Además del enlace al correo, la entrada puede ofrecer "Continuar con Google" (#132). Google solo comprueba que la persona es dueña de un correo que ya fue invitado. Siguen mandando dos candados: el registro público apagado en Supabase y la comprobación del perfil después de entrar. Ninguno se cambia para que Google funcione.

| Variable                 | Qué es                                                                             | Dónde se pone                                            |
| ------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `GOOGLE_SIGN_IN_ENABLED` | `true` pinta el botón. Vacía, ausente o `false`, no. Otro valor impide el arranque | `.env.local` en local; variables del servicio en Railway |

Las credenciales de Google (identificador y secreto del cliente) viven en Supabase. El servidor del sitio no las conoce y ninguna va al repositorio.

#### 1. Crear el cliente OAuth (una sola vez)

Lo hace Camilo en [Google Cloud](https://console.cloud.google.com/). Los nombres de los menús pueden cambiar un poco.

1. Elegir o crear un proyecto, por ejemplo `volleytip`.
2. Abrir **Google Auth Platform** → **Branding** (antes "Pantalla de consentimiento de OAuth"): nombre `VolleyTip`, correo de asistencia y correo de contacto.
3. **Audience**: tipo "External". Publicar la aplicación ("Publish app"). Mientras esté en "Testing" solo entran los correos agregados como usuarios de prueba. Los permisos que se piden son los básicos (correo y perfil), que no necesitan revisión de Google.
4. **Clients** → "Create client" → tipo "Web application", nombre `VolleyTip panel`.
5. En **Authorized redirect URIs** agregar las dos direcciones de retorno, la de pruebas y la de producción. El identificador es el Project ID de cada proyecto de Supabase:
   - `https://<identificador-de-volleytip-dev>.supabase.co/auth/v1/callback`
   - `https://<identificador-de-volleytip-prod>.supabase.co/auth/v1/callback`
   - Solo si se va a probar contra la base local: `http://127.0.0.1:54321/auth/v1/callback`

   La dirección exacta de cada proyecto la muestra Supabase en la pantalla del paso 2, campo "Callback URL (for OAuth)". "Authorized JavaScript origins" se deja vacío: el navegador nunca habla con Google desde el código del sitio.

6. Guardar el **Client ID** y el **Client secret** en el gestor de contraseñas.

#### 2. Pegarlo en cada proyecto de Supabase

Se repite en `volleytip-dev` y en `volleytip-prod`, con el mismo cliente:

1. Authentication → Sign In / Providers → Google → "Enable Sign in with Google".
2. Pegar el Client ID en "Client IDs" y el secreto en "Client Secret (for OAuth)". "Skip nonce checks" queda apagado. Guardar.
3. Authentication → URL Configuration: comprobar que "Redirect URLs" tiene el origen del entorno seguido de `/**` (paso 2 de "El correo para entrar"). Sin eso, la vuelta de Google cae en la Site URL y no se entra.
4. Authentication → Sign In / Providers → "Allow new users to sign up": sigue **desactivado**. Si una cuenta invitada no logra entrar con Google, no se arregla encendiéndolo: se reporta.

Supabase une la identidad de Google a la cuenta que ya existe con el mismo correo, si ese correo está confirmado (el comando del primer admin lo deja así), sin crear una segunda cuenta. Eso es lo que describe Supabase: se da por comprobado cuando pasa la sección 4.

#### 3. Encender el botón en cada entorno

| Entorno    | Cómo                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Staging    | En Railway, servicio `staging`, pestaña Variables: `GOOGLE_SIGN_IN_ENABLED` = `true`           |
| Producción | Lo mismo en el servicio `production`                                                           |
| Local      | Los dos pasos de abajo                                                                         |
| Pruebas    | No se enciende. Las pruebas usan un Supabase simulado y la muestra `/dev/entrar?estado=google` |

El botón se enciende **después** de configurar el proveedor de ese entorno. Para apagarlo se quita la variable. Eso esconde el botón; para cerrar del todo la entrada con Google se desactiva además el proveedor en Supabase.

**En local** (opcional):

1. La base local lee tres variables de la terminal desde la que se levanta. `supabase/config.toml` deja Google apagado si no están. En Git Bash, una línea a la vez:

   ```
   read -rp "Client ID: " SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID && export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
   read -rsp "Client secret: " SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET && export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET
   export SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true
   npm run db:stop && npm run db:start
   ```

2. En `.env.local`: `GOOGLE_SIGN_IN_ENABLED=true` y `SITE_ORIGIN=http://localhost:3740`. El sitio se abre en esa misma dirección, no en `127.0.0.1`.

#### 4. Comprobar (en pruebas, con credenciales reales)

1. Crear o invitar un admin con un correo de Google que **nunca** haya entrado con Google (ver "El primer admin de cada entorno").
2. En Supabase, Authentication → Users: anotar cuántos usuarios hay.
3. En `https://staging.volleytip.com/admin/entrar`, "Continuar con Google" con ese correo. Debe llegar al panel. En Users sigue el mismo número de usuarios, y la cuenta muestra los proveedores Email y Google.
4. Cerrar sesión y repetir con una cuenta de Google que no esté invitada. La pantalla dice que ese correo no tiene acceso y en Users no aparece ningún usuario nuevo.
5. Pulsar "Continuar con Google" y cancelar en la pantalla de Google: se vuelve a la entrada con un mensaje y sin sesión.
6. Pulsarlo de nuevo y, en la pantalla de Google, usar el botón "atrás" del navegador (mejor en el celular): la entrada reaparece y el botón vuelve a responder.

**Si algo falla**, el registro del servidor dice "Supabase Auth no canjeó la vuelta de Google" o "La entrada con Google volvió con error", con el código. En Supabase está en Logs → Auth.

## Imágenes

Las fotos de productos, camps y tips se sirven por Bunny Optimizer, que las entrega en el ancho que cada pantalla pide (FR-123). El código que arma las direcciones lo construyó el ticket #36: `src/lib/images/image-url.ts` y el componente `src/components/optimized-image.tsx`.

| Variable         | Qué es                                                    | Dónde se obtiene                                |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `IMAGE_CDN_HOST` | Dominio de la zona de Bunny, sin `https://` ni ruta final | Panel de Bunny, la Pull Zone, campo "Hostnames" |

No es un secreto: llega al navegador en la dirección de cada imagen. Staging y producción usan la misma zona. En local y en las pruebas basta cualquier dominio con forma válida, porque nada pide una imagen de verdad.

### Cómo está armado en Bunny

- **Una Storage Zone** guarda los archivos originales.
- **Una Pull Zone** los sirve. Su origen es esa Storage Zone y su dominio es `<nombre>.b-cdn.net`.
- **Bunny Optimizer** va activado en la Pull Zone, con dos ajustes encendidos:
  - "Dynamic Image API": deja pedir un ancho con `?width=`.
  - "WebP Image Compression": entrega WebP a los navegadores que lo aceptan, sin cambiar la dirección.

Optimizer cuesta US$9,50 al mes por zona, más el tráfico. Fuente, consultada el 21 de noviembre de 2026: <https://bunny.net/pricing/optimizer/>.

### Cómo se usa en el código

- La página recibe el dominio de su `loader` (`serverEnv.imageCdnHost`) y se lo pasa a `<OptimizedImage>`, con la ruta de la imagen dentro del almacenamiento, el texto alternativo, el ancho y el alto.
- El componente pide dos anchos, el normal y el doble para pantallas de alta densidad, y siempre lleva `width` y `height` para que la página no salte al cargar.
- **Los logos no pasan por aquí.** Viven en `public/brand/` y se pintan con `<img>`. El constructor rechaza una ruta que empiece por `brand/`.
- **El formato no va en la dirección.** Lo negocia Bunny con el navegador. La documentación de Bunny solo describe esa negociación automática para WebP, no para AVIF.

## Videos (Bunny Stream)

Los videos de los tips viven en Bunny Stream. El servidor lista, lee y crea videos con la API y firma las subidas que hará el navegador (#152). El código está en `src/lib/bunny/`.

| Variable                  | Qué es                                                        | Dónde se obtiene                                                     |
| ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `BUNNY_STREAM_LIBRARY_ID` | Número de la librería de videos                               | Panel de Bunny, Stream, la librería, sección API: "Video Library ID" |
| `BUNNY_STREAM_API_KEY`    | Llave de API de **esa librería**, no la de la cuenta. Secreta | La misma sección: "API Key"                                          |
| `BUNNY_STREAM_CDN_HOST`   | Dominio de la zona de la librería, sin `https://` ni ruta     | La misma sección: "CDN Hostname"                                     |

Los nombres de los menús pueden cambiar un poco entre versiones del panel.

- **La llave de API es secreta.** Solo la lee el servidor. El navegador recibe una firma que sirve para subir un video y vence en una hora.
- **El dominio no es un secreto.** Llega al navegador en la dirección de cada miniatura. No es el de `IMAGE_CDN_HOST`: cada librería de Stream tiene su propia zona.
- **Se validan al arrancar.** El id tiene que ser un número, la llave no lleva espacios ni tildes y el dominio va sin protocolo ni ruta. Si algo falla, el servidor no arranca y dice cuál.
- **Antes de desplegar**, las tres tienen que estar en los dos servicios de Railway. Sin ellas el servidor no arranca.

### Dos librerías

Las dos viven en la misma cuenta de Bunny. El código no las distingue: cada entorno recibe las tres variables de la suya.

| Entorno    | Librería                          | Dónde se ponen                                 |
| ---------- | --------------------------------- | ---------------------------------------------- |
| Local      | La de pruebas                     | `.env.local`                                   |
| Staging    | La de pruebas                     | Variables del servicio `staging` en Railway    |
| Producción | La real, con los videos del sitio | Variables del servicio `production` en Railway |
| Pruebas    | Ninguna: usan un Bunny simulado   | Las pone la corrida                            |

La librería de pruebas existe para que probar la subida no ensucie la real. Local y staging la comparten, que es la excepción a "ninguna llave se repite". Producción nunca la usa.

En cada librería, en su sección de seguridad, "Allowed domains" lleva:

- **La de pruebas:** `staging.volleytip.com` y `localhost`.
- **La real:** `volleytip.com` y la dirección de Railway de producción.

En las dos, el acceso directo a archivos queda sin bloquear, porque las miniaturas se pintan con `<img>`.

Con `APP_ENV=test` el servidor usa el simulado (`src/testing/fake-bunny-stream.server.ts`) y ninguna petición sale hacia Bunny.

## Dirección pública del sitio

Cada página declara a los buscadores su dirección canónica y sus versiones en cada idioma (`hreflang`). Esas direcciones tienen que ser absolutas y con `https`, y no pueden salir de la petición: detrás del proxy de Railway el servidor la ve llegar por `http`. Por eso el dominio público es una variable.

| Variable      | Qué es                                                    | Staging                         | Producción                                                    |
| ------------- | --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `SITE_ORIGIN` | Protocolo y dominio públicos del entorno, sin barra final | `https://staging.volleytip.com` | `https://production-volleytip.up.railway.app`, hasta W13 (#8) |

- **No es un secreto.** Llega al navegador con los datos de cada página.
- **Se valida al arrancar.** Con ruta, con barra final, con parámetros o sin protocolo, el servidor no arranca. Fuera de `local` y `test` tiene que empezar por `https`.
- **En local** va la dirección del servidor de desarrollo, `http://localhost:3740`. Las pruebas ponen la suya.
- **Cuando producción reciba `volleytip.com` (W13)** hay que cambiar el valor en el servicio `production`. Mientras tanto, las direcciones canónicas de producción apuntan a la dirección provisional.

### Cómo se usa en el código

- Las páginas del sitio se declaran una vez en `src/lib/i18n/pages.ts`. De esa lista salen las rutas y la dirección de cada enlace.
- Un enlace interno usa `<LocalizedLink page="...">` (`src/components/localized-link.tsx`) o un botón con `to="..."`. Reciben una página del mapa, no una dirección, y llevan a esa página en el idioma de la actual.
- La canónica y los `hreflang` los pinta `<LanguageAlternates>` desde `src/root.tsx`, una sola vez para todo el sitio. Una página de error o una dirección fuera del mapa no las lleva.
- El selector de idioma es `<LanguageSwitcher>` (`src/components/language-switcher.tsx`).
