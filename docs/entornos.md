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

`src/lib/env.server.ts` valida las cuatro variables cuando el servidor carga. Si falta alguna, está vacía o `APP_ENV` no es uno de los cuatro valores, el servidor no arranca y el mensaje nombra cada variable con problema. Nunca imprime un valor.

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

Se ponen en la pestaña Variables del servicio. Son las cuatro de la aplicación, y ninguna llave se repite entre los dos.

| Variable                    | Servicio `staging` | Servicio `production` |
| --------------------------- | ------------------ | --------------------- |
| `APP_ENV`                   | `staging`          | `production`          |
| `SUPABASE_URL`              | De `volleytip-dev` | De `volleytip-prod`   |
| `SUPABASE_ANON_KEY`         | De `volleytip-dev` | De `volleytip-prod`   |
| `SUPABASE_SERVICE_ROLE_KEY` | De `volleytip-dev` | De `volleytip-prod`   |

De dónde sale cada valor está arriba, en "Variables de la aplicación".

- **`SUPABASE_SERVICE_ROLE_KEY` va sellada** (menú de la variable, Seal). Sellada no se puede leer desde el panel ni desde la API de Railway; el servidor la recibe igual. No se puede quitar el sello: para cambiarla se reemplaza el valor. El original sigue en el gestor de contraseñas.
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

Nadie despliega a mano. Cada merge a `main` despliega los dos servicios, staging y producción, en cuanto los workflows del commit terminan en verde. Si un workflow falla, Railway no despliega ese commit y sigue sirviendo el anterior.

**Pendiente de comprobar (#31):** que Railway espera también al workflow de migraciones y no solo a `checks`, y que un workflow en rojo de verdad frena el despliegue. Es la pregunta abierta 5 del PRD. Hasta que quede anotado aquí el resultado, el párrafo de arriba describe lo que se configuró, no lo que se vio. Si Railway no espera a las migraciones, el despliegue lo tendrá que disparar ese workflow al terminar, y eso va en un ticket aparte.

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

Pendiente: lo completa el ticket #34, con las variables de Turnstile, el secreto de firma y la cabecera de IP.

## Imágenes

Pendiente: lo completa el ticket #36, con el dominio del CDN de imágenes.
