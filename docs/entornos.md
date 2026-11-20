# Entornos y variables

Qué entornos tiene volleytip.com, qué variables necesita cada uno, dónde se obtiene cada valor y dónde se pone. Este documento solo lleva **nombres**. Ningún valor real (llaves, contraseñas, URLs de proyecto) se escribe aquí ni en ningún otro archivo del repo.

Lo abrió el ticket #23. Lo completan #29 (secretos del workflow de migraciones), #31 (Railway), #34 (Turnstile y protección de formularios) y #36 (imágenes).

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

Se ponen en la pestaña Variables del servicio. Son las cuatro de la aplicación y las cinco de la protección de formularios. Ninguna llave ni secreto se repite entre los dos.

| Variable                    | Servicio `staging`    | Servicio `production`    |
| --------------------------- | --------------------- | ------------------------ |
| `APP_ENV`                   | `staging`             | `production`             |
| `SUPABASE_URL`              | De `volleytip-dev`    | De `volleytip-prod`      |
| `SUPABASE_ANON_KEY`         | De `volleytip-dev`    | De `volleytip-prod`      |
| `SUPABASE_SERVICE_ROLE_KEY` | De `volleytip-dev`    | De `volleytip-prod`      |
| `TURNSTILE_SITE_KEY`        | Del widget de staging | Del widget de producción |
| `TURNSTILE_SECRET_KEY`      | Del widget de staging | Del widget de producción |
| `FORM_PROTECTION_SECRET`    | Generado para staging | Generado para producción |
| `CLIENT_IP_HEADER`          | `X-Real-IP`           | El mismo que staging     |
| `CLIENT_IP_TRUSTED_HOPS`    | `1`                   | El mismo que staging     |

De dónde sale cada valor está arriba, en "Variables de la aplicación", y abajo, en "Protección de formularios".

- **`SUPABASE_SERVICE_ROLE_KEY` va sellada** (menú de la variable, Seal). Sellada no se puede leer desde el panel ni desde la API de Railway; el servidor la recibe igual. No se puede quitar el sello: para cambiarla se reemplaza el valor. El original sigue en el gestor de contraseñas.
- **`TURNSTILE_SECRET_KEY` y `FORM_PROTECTION_SECRET` también van selladas.**
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

## Imágenes

Pendiente: lo completa el ticket #36, con el dominio del CDN de imágenes.
