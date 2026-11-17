# Entornos y variables

Qué entornos tiene volleytip.com, qué variables necesita cada uno, dónde se obtiene cada valor y dónde se pone. Este documento solo lleva **nombres**. Ningún valor real (llaves, contraseñas, URLs de proyecto) se escribe aquí ni en ningún otro archivo del repo.

Lo abrió el ticket #23. Lo completan #29 (secretos del workflow de migraciones), #31 (Railway), #34 (Turnstile y protección de formularios) y #36 (imágenes).

## Entornos

| Entorno    | `APP_ENV`    | Dónde corre                                   | Base de datos                         |
| ---------- | ------------ | --------------------------------------------- | ------------------------------------- |
| Local      | `local`      | La máquina de cada persona (`npm run dev`)    | Base local de Supabase CLI (#21)      |
| Pruebas    | `test`       | Vitest y Playwright, en la máquina y en el CI | Base local de Supabase CLI            |
| Staging    | `staging`    | Railway, `staging.volleytip.com` (#31)        | Proyecto `volleytip-dev` de Supabase  |
| Producción | `production` | Railway (#31). Recibe `volleytip.com` en W13  | Proyecto `volleytip-prod` de Supabase |

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
| Pruebas    | Las pone la propia corrida de pruebas (#21)                    | De la base local                                |
| Staging    | Variables del servicio de pruebas en Railway (#31)             | `volleytip-dev`                                 |
| Producción | Variables del servicio de producción en Railway (#31)          | `volleytip-prod`                                |

Ninguna llave se comparte entre staging y producción. `.env.example` (lo crea #22) lista los mismos nombres sin valores.

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

Pendiente: los lista el ticket #29.

## Railway

Pendiente: lo completa el ticket #31, con las variables de cada servicio y cómo se despliega producción.
