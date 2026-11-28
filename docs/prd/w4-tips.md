# PRD: W4 · Tips

**Estado:** aprobado · **Fecha:** 28 de noviembre de 2026 · **Autor:** Camilo, con Claude · **Épica:** #4

Fuentes: `docs/SRD-volleytip-web-v1.4.md` (FR-012 a FR-017, FR-060, FR-066, FR-078; AC-024 a AC-026, AC-028, AC-034; US-01, US-06; NFR-001, NFR-008), `docs/plan-maestro.md`, `docs/modelo-de-datos.md` (sección de tips), `docs/prd/w3-navegacion-home-paginas-de-apoyo.md` (lo que dejó para esta épica) y los mockups `Tips`, `Tip`, `TipMovil` y `AdminMovil--subir`. Lo que se afirma de Bunny Stream se leyó en su documentación el 28 de noviembre de 2026; cada ticket lo confirma otra vez antes de usarlo.

## 1. Problema

VolleyTip tiene 105 videos cortos en Bunny Stream y una audiencia grande en TikTok e Instagram, pero ningún lugar propio donde verlos. El sitio nuevo ya tiene home, menú y panel, y el enlace "Tips" del menú no lleva a nada. El héroe de la home manda a TikTok porque no hay a dónde más mandar.

Los tips son la razón por la que alguien llega al sitio y la vitrina de todo lo que se venderá después (BR-010). Sin ellos, la vitrina de L1 está vacía.

Tampoco hay cómo publicarlos. Andrés graba en la cancha y hoy sube el video a las redes desde el celular. Para que el sitio siga creciendo necesita hacer lo mismo aquí, sin pasar por un computador ni por nadie más.

## 2. Usuarios y contexto

- **Seguidor que llega desde TikTok o Instagram:** en celular, a un tip concreto. Quiere verlo y seguir con otro del mismo tema (US-01).
- **Jugador que busca algo:** quiere "recepción básica" y encontrarlo en dos toques, o escribir "saque flotado".
- **Visitante que lee en inglés:** el audio está en español. Lee en inglés los textos del tip donde existan.
- **Andrés:** publica tips, casi siempre desde el celular y a veces en la cancha (US-06). Tiene 105 videos por clasificar antes del lanzamiento.
- **La futura app:** leerá los mismos tips desde Supabase, sin pasar por el sitio.
- **Hoy lo resuelven así:** los videos solo se ven en redes. En Bunny están sin fundamento, nivel ni textos.

## 3. Objetivo y métricas de éxito

- **Objetivo:** que cualquiera vea, filtre, busque y comparta los tips en volleytip.com, y que Andrés publique uno nuevo desde el celular en pocos minutos.
- **Métricas:**
  - Con los filtros Recepción y Básico, la dirección los refleja, solo salen tips que cumplen los dos y al recargar se conservan (AC-024).
  - En un tip vertical en celular, "Siguiente" abre el siguiente del mismo fundamento y se deshabilita en el último (AC-025).
  - Importar un video de Bunny crea un tip en borrador con video, duración y miniatura ya cargados (AC-026).
  - Un cliente sin sesión que consulta la vista de tips recibe solo los publicados (AC-034).
  - LCP menor a 2,5 s en celular 4G en la página de un tip; el video no carga hasta que se toca (NFR-001).
  - Andrés clasifica y publica los 105 videos existentes sin escribir en la base.
  - axe sin violaciones en todas las pantallas, a 360, 390, 768 y 1440 px.

## 4. Alcance

**Incluido:**

- Las tablas de tips y la vista de solo lectura para la app.
- El listado público: filtros por fundamento y nivel, búsqueda, último video, lo más visto de la semana y carga de 20 en 20.
- El detalle del tip: reproductor vertical u horizontal, textos, anterior y siguiente, relacionados y bloque de promoción.
- Compartir, "Ver en TikTok", y en celular la barra fija y el carrusel.
- Un contador propio de vistas.
- El módulo Tips del panel: lista, editor por idioma, programación, destacado y promo.
- Importar los videos que ya están en Bunny, y clasificarlos rápido.
- Subir un video nuevo desde el celular, directo a Bunny.
- Los bloques de la home que W3 dejó pendientes (último video, fundamentos con conteo, botón "Ver los tips") y el buscador de tips en la página 404.

**Explícitamente fuera (por ahora):**

- Voz doblada a otros idiomas. Lo dijo Camilo el 28 de noviembre de 2026: después.
- Publicar el mismo video en TikTok, Instagram y YouTube desde el panel. Cada red pide aprobar una app propia y por API no se usan su música ni sus efectos. Si se quiere, va como épica aparte después del lanzamiento, empezando por una sola red. Mientras tanto, las redes se publican desde sus apps o con una herramienta de programación.
- Subtítulos, generados o subidos. Lo dijo Camilo el 28 de noviembre de 2026: por ahora no. Cuando se quieran, Bunny los genera por unos US$0,10 por minuto de video y por idioma.
- Sugerir con IA las tres claves o la frase de logro a partir del video.
- Promo de camp y de producto, y el paquete digital relacionado (FR-106). El bloque de promoción nace con app y redes; W8, W5 y W14 agregan los suyos cuando existan camps, productos y paquetes.
- Comentarios, "me gusta" y listas de favoritos.
- Páginas separadas por fundamento. Hay un solo listado y el fundamento es un filtro.
- Estadísticas de Bunny en el panel (retención, países). El panel solo muestra las vistas propias.
- `sitemap.xml`. Lo arma W13 e incluye los tips.
- Avisos de Bunny al sitio (webhooks). Ver la decisión 3.

## 5. Requerimientos funcionales

### RF-1 · Tips en la base y lectura para la app · Must

Los tips viven en `tips` y `tip_translations`, y se exponen por una vista de solo lectura (FR-076, FR-078).

- **Dado** un tip, **entonces** tiene un video de Bunny, orientación, duración, miniatura, un fundamento y un nivel de listas fijas, enlace de TikTok opcional, promo, destacado, estado y fecha de publicación.
- **Dado** los fundamentos, **entonces** son seis: saque, recepción, colocación, ataque, bloqueo y defensa. Los niveles son tres: básico, intermedio y avanzado. Sus nombres visibles salen de los archivos de traducción.
- **Dado** los textos de un tip, **entonces** van por idioma: título, frase de logro, tres claves, "Error común" y "Practícalo".
- **Dado** un video de Bunny, **entonces** pertenece como máximo a un tip.
- **Dado** un visitante sin sesión, **entonces** lee solo tips publicados cuya fecha de publicación ya pasó. No lee borradores, retirados ni programados.
- **Dado** un cliente con la llave pública de Supabase y sin sesión, **cuando** consulta `public_tips`, **entonces** recibe solo esos tips, con sus traducciones y el id del video (AC-034).
- **Dado** un admin, **entonces** lee y escribe todos. Un comprador o un staff con sesión ve lo mismo que un visitante.
- **Dado** un tip sin texto en inglés, **entonces** `/en/` lo muestra en español (FR-007).

### RF-2 · Listado de tips · Must

Una sola página con todos los tips (FR-013, mockup `Tips.png`).

- **Dado** el listado, **entonces** muestra los publicados del más reciente al más antiguo, con miniatura, duración, fundamento, título y nivel.
- **Dado** los filtros de fundamento y de nivel, **entonces** se combinan, viven en la dirección y se conservan al recargar o compartir el enlace (AC-024).
- **Dado** la búsqueda, **entonces** busca en título, frase de logro y claves del idioma de la página, sin distinguir mayúsculas ni tildes, y se combina con los filtros.
- **Dado** más de 20 resultados, **entonces** "Cargar más tips" trae los 20 siguientes sin perder los que ya estaban. Sin JavaScript es un enlace a la página siguiente.
- **Dado** el listado sin filtros ni búsqueda, **entonces** arriba van el último video (el destacado, si hay uno) y lo más visto de la semana. Con filtros o búsqueda no se muestran.
- **Dado** el contador del encabezado, **entonces** dice cuántos tips publicados hay.
- **Dado** filtros o una búsqueda sin resultados, **entonces** lo dice y ofrece quitarlos.
- **Dado** que no hay ningún tip publicado, **entonces** la página lo dice e invita a seguir las redes.
- **Dado** un valor de filtro que no existe en la dirección, **entonces** se ignora y la página carga sin ese filtro.

### RF-3 · Detalle del tip · Must

La página de un tip (FR-014, mockups `Tip.png` y `TipMovil.png`).

- **Dado** un tip publicado, **entonces** su página muestra el reproductor, fundamento, nivel, duración, título, frase de logro, las claves y, si existen, "Error común" y "Practícalo".
- **Dado** un tip vertical, **entonces** el reproductor va en 9:16; uno horizontal, en 16:9. La página reserva su espacio y no salta.
- **Dado** la página recién cargada, **entonces** se ve la miniatura con el botón de reproducir, y el reproductor de Bunny carga al tocarlo (NFR-001).
- **Dado** "Anterior" y "Siguiente", **entonces** recorren los tips publicados del mismo fundamento, por fecha de publicación, y dicen "Tip 3 de N". En el primero no hay anterior y en el último no hay siguiente (AC-025).
- **Dado** "Sigue con [fundamento]", **entonces** muestra hasta cinco tips siguientes del mismo fundamento y un enlace al listado filtrado.
- **Dado** el bloque de promoción, **entonces** muestra lo que el tip tiene configurado: la app o las redes. Sin configurar, las redes.
- **Dado** un tip sin frase de logro o sin claves, **entonces** la página omite ese bloque sin dejar huecos.
- **Dado** un tip en borrador, retirado, programado o que no existe, **entonces** responde 404.
- **Dado** la página, **entonces** tiene título y descripción propios por idioma, dirección canónica, `hreflang`, imagen para compartir (la miniatura) y datos estructurados de video (NFR-008).
- **Dado** el migajas "Tips / [fundamento] / [título]", **entonces** el fundamento enlaza al listado filtrado.

### RF-4 · Compartir · Must

Un tip se comparte fácil (FR-015).

- **Dado** un celular con menú nativo de compartir, **cuando** se toca "Compartir tip", **entonces** se abre ese menú con el título y la dirección.
- **Dado** un navegador sin ese menú, **entonces** copia la dirección y lo confirma con un aviso que un lector de pantalla anuncia.
- **Dado** que la persona cancela el menú, **entonces** no pasa nada ni sale un error.
- **Dado** un tip con enlace de TikTok, **entonces** aparece "Ver en TikTok", que abre en otra pestaña. Sin enlace, el botón no existe.
- **Dado** el navegador sin JavaScript, **entonces** la dirección se puede copiar de un campo de texto.

### RF-5 · Barra fija y carrusel en celular · Must

En celular el tip se recorre con el pulgar (FR-016, AC-025).

- **Dado** un tip en celular, **entonces** una barra fija ofrece Anterior, Compartir y Siguiente, con zonas de toque de 44 px o más.
- **Dado** el último tip del fundamento, **entonces** Siguiente queda deshabilitado; lo mismo Anterior en el primero.
- **Dado** la barra, **entonces** no tapa el final del contenido ni el control que tiene el foco.
- **Dado** los relacionados en celular, **entonces** van en un carrusel horizontal que se desliza con el dedo y se recorre con teclado.
- **Dado** "Error común" y "Practícalo" en celular, **entonces** van plegados y se abren al tocarlos.

### RF-6 · Vistas y lo más visto · Must

El sitio cuenta sus propias reproducciones (FR-013).

- **Dado** un tip, **cuando** alguien inicia la reproducción, **entonces** se cuenta una vista para ese tip y ese día.
- **Dado** la misma persona que reproduce el mismo tip varias veces en la misma visita, **entonces** cuenta una vez.
- **Dado** muchas peticiones de conteo desde un mismo origen, **entonces** el límite de la utilidad de formularios las corta y el video sigue funcionando.
- **Dado** el conteo, **entonces** no guarda la IP ni nada que identifique a la persona.
- **Dado** "Lo más visto esta semana", **entonces** muestra los tres tips publicados con más vistas en los últimos siete días, con su número.
- **Dado** menos de tres tips con vistas en la semana, **entonces** el bloque se completa con los más recientes y no muestra un número en ellos.
- **Dado** que el conteo falla, **entonces** el visitante no ve ningún error.

### RF-7 · Tips en el panel · Must

Un módulo "Tips" para crear, editar y publicar (FR-060).

- **Dado** el módulo, **entonces** lista todos los tips con miniatura, título, fundamento, nivel, estado y fecha, de 50 en 50, con filtros por estado y fundamento y búsqueda por título.
- **Dado** el editor, **entonces** tiene una pestaña por idioma activo con título, frase de logro, tres claves, "Error común" y "Practícalo", y marca qué idiomas tienen texto.
- **Dado** el editor, **entonces** permite elegir fundamento, nivel, enlace de TikTok, promo (app o redes), destacado y fecha de publicación.
- **Dado** "Publicar", **entonces** exige título en español, fundamento, nivel y un video que Bunny ya terminó de procesar. Lo que falte se marca en su campo.
- **Dado** una fecha de publicación futura, **entonces** el tip queda programado: el panel lo dice y el sitio lo muestra cuando llega la fecha, sin que nadie haga nada.
- **Dado** un tip publicado, **entonces** se puede retirar y volver a publicar. No se puede borrar.
- **Dado** un tip marcado como destacado, **entonces** el que lo era deja de serlo: hay uno solo.
- **Dado** un tip nuevo, **entonces** su dirección sale del título en español y se puede cambiar hasta la primera publicación. Después queda fija.
- **Dado** dos tips con el mismo título, **entonces** sus direcciones no chocan.
- **Dado** un enlace de TikTok que no es de tiktok.com, o un texto más largo que su límite, **entonces** se rechaza con el error en el campo y conserva lo escrito.
- **Dado** un tip sin inglés, **entonces** la lista avisa que en `/en/` saldrá en español.
- **Dado** crear, editar, publicar, retirar o destacar, **entonces** queda en la bitácora.
- **Dado** el editor abierto, **entonces** muestra las vistas de la semana y el total de ese tip.

### RF-8 · Importar los videos de Bunny · Must

Los videos que ya existen se vuelven tips sin subirlos otra vez (FR-017, AC-026).

- **Dado** "Importar de Bunny", **entonces** lista los videos de la librería que todavía no son un tip, con miniatura, título, duración y orientación, paginados.
- **Dado** uno o varios videos elegidos, **cuando** se importan, **entonces** se crea un tip en borrador por cada uno, con el video, la duración, la miniatura y la orientación ya cargados, y el título de Bunny como título en español (AC-026).
- **Dado** un video que Bunny no ha terminado de procesar o que falló, **entonces** aparece en la lista sin poder elegirse, con su estado.
- **Dado** un video ya importado, **entonces** no vuelve a aparecer, y un doble envío no crea dos tips.
- **Dado** que Bunny no responde, **entonces** la pantalla lo dice y deja reintentar; los tips que ya existen no se afectan.
- **Dado** la librería sin videos pendientes, **entonces** lo dice.
- **Dado** una importación, **entonces** queda en la bitácora cuántos tips creó.

### RF-9 · Clasificar rápido · Should

Poner fundamento y nivel a muchos borradores sin abrir cada uno.

- **Dado** la lista de tips filtrada por borradores, **entonces** cada fila deja elegir fundamento y nivel y guardarlos sin salir de la lista.
- **Dado** una fila con todo lo que pide publicar, **entonces** ofrece "Publicar" ahí mismo.
- **Dado** un cambio guardado desde la lista, **entonces** queda en la bitácora como cualquier otro.
- **Dado** un envío que no llega, **entonces** la fila lo avisa y conserva lo elegido.

### RF-10 · Subir un video desde el celular · Must

Andrés graba, sube y publica desde el panel (FR-060, FR-066, US-06, mockup `AdminMovil--subir`).

- **Dado** "Subir tip" en la barra inferior del panel en celular, **entonces** abre "Nuevo tip" con un botón para elegir un video de la galería o grabarlo.
- **Dado** un video elegido, **entonces** sube directo a Bunny, sin pasar por el servidor del sitio, con barra de progreso y porcentaje.
- **Dado** la subida en curso, **entonces** se puede seguir llenando título, fundamento, nivel y claves.
- **Dado** una subida que se corta por la red, **entonces** se reanuda desde donde iba al volver la conexión, sin empezar de cero.
- **Dado** la subida terminada, **entonces** la pantalla dice que Bunny está procesando el video y avisa cuando queda listo, con su duración, miniatura y orientación.
- **Dado** "Guardar borrador" con el video todavía procesando, **entonces** el tip se guarda. "Publicar" espera a que el video esté listo y lo dice.
- **Dado** un archivo que no es de video o que pesa más del límite, **entonces** se rechaza antes de subir.
- **Dado** que la persona cierra la pantalla a mitad de la subida, **entonces** el navegador pide confirmar. Si sale, el video incompleto no queda como tip.
- **Dado** la firma de subida, **entonces** la genera el servidor para un solo video, vence en una hora y la llave de Bunny nunca llega al navegador.
- **Dado** el formulario en celular, **entonces** pide lo mínimo (título, fundamento, nivel y claves) y dice que lo demás se completa después.

### RF-11 · Tips en la home y en la 404 · Must

Los bloques que W3 dejó para esta épica (FR-012, AC-028).

- **Dado** la home, **entonces** el héroe muestra "Ver los tips", que lleva al listado.
- **Dado** la home, **entonces** muestra el último video (el destacado, si hay) con su título, fundamento, nivel y enlace al tip.
- **Dado** la home, **entonces** muestra los seis fundamentos con cuántos tips publicados tiene cada uno, y cada uno enlaza al listado filtrado.
- **Dado** que no hay tips publicados, **entonces** esos bloques no se pintan y el héroe conserva su botón a TikTok.
- **Dado** la página 404, **entonces** ofrece un buscador que lleva al listado con esa búsqueda (AC-028).
- **Dado** el menú del sitio, **entonces** "Tips" lleva al listado y se marca como actual en el listado y en cada tip.

## 6. Casos borde y estados de error

- **Bunny caído o lento:** el sitio público no lo consulta para pintar el listado ni el detalle; todo sale de la base. Solo falla el reproductor, que muestra su propio error. El importador y la subida lo dicen y dejan reintentar.
- **Video borrado en Bunny con el tip publicado:** el reproductor falla. El editor lo detecta al abrir el tip y lo avisa; no se retira solo.
- **Miniatura que no carga:** queda el recuadro con el color de fondo y el título sigue legible.
- **Tip con un solo compañero de fundamento:** "Sigue con" muestra el que hay. Si no hay ninguno, el bloque no se pinta.
- **Título muy largo, o en inglés más largo:** se corta en las tarjetas con puntos suspensivos y sale completo en el detalle.
- **Búsqueda con caracteres raros o muy larga:** se limita a 100 caracteres y se trata como texto.
- **Dos admins editan el mismo tip:** gana el último y la bitácora guarda los dos cambios, como en el resto del panel.
- **Dos admins importan a la vez:** la regla de un video por tip evita duplicados; al segundo le dice cuáles ya estaban.
- **Tip programado cuyo video falla después:** no se puede: publicar y programar exigen el video listo.
- **Subida desde el celular con la pantalla apagada o la app en segundo plano:** el navegador puede pausarla. Al volver se reanuda.
- **Video horizontal grabado con el celular de lado:** la orientación sale del ancho, el alto y la rotación que reporta Bunny.
- **500 tips:** el listado pagina en el servidor; la búsqueda y los filtros usan índices.
- **Visitante con bloqueador que no deja cargar el reproductor:** queda la miniatura y, si existe, el enlace a TikTok.
- **Concurrencia en las migraciones:** los tickets con migración van uno tras otro, en el mismo carril que cualquier otra épica abierta.

## 7. UX / UI

- **Mockups:** `docs/mockups/Tips.png` (listado), `Tip.png` y `TipMovil.png` (detalle) y `AdminMovil--subir.png` (subir desde el celular).
- **Sin mockup:** el listado en celular (P-25), la lista y el editor de tips en computador, el importador y la clasificación rápida. Se construyen desde `Tips.png`, `Admin.png` y `design-system.md`.
- **Donde manda este documento y no el mockup:** el menú es el único del SRD, con VBall Tour (P-24). El bloque de promoción del detalle muestra la app o las redes, no un camp, hasta que existan camps. La barra inferior del panel muestra solo los lugares que existen: se agrega "Subir tip".
- **Zona oscura:** las páginas públicas de tips van sobre `brand-night`, como en el mockup. El panel sigue en zona clara.
- **Flujo del seguidor:** llega desde TikTok a un tip en el celular, toca reproducir, toca "Siguiente" dos veces y comparte el tercero.
- **Flujo de carga inicial:** Andrés abre "Importar de Bunny", elige los 105 videos por tandas, y en la lista de borradores le pone fundamento y nivel a cada uno y publica.
- **Flujo en la cancha:** Andrés toca "Subir tip", elige el video, escribe título y claves mientras sube, guarda el borrador y publica cuando Bunny termina.
- **Viewports a soportar:** 360, 390, 768 y 1440 px.

## 8. Requerimientos no funcionales

- **Rendimiento:** LCP menor a 2,5 s en celular 4G en el detalle y el listado. La miniatura principal carga con prioridad; las demás, perezosas y con su espacio reservado. El reproductor no se descarga hasta que se toca.
- **Seguridad:** la llave de la librería de Bunny vive solo en el servidor. La firma de subida sirve para un video y vence. Las tablas nacen con RLS: lo no publicado no se lee sin sesión de admin. El conteo de vistas no acepta escribir nada más que una vista.
- **Privacidad:** el conteo de vistas no guarda IP ni identificadores. El reproductor de Bunny es de un tercero y queda nombrado en la política de privacidad.
- **Accesibilidad:** WCAG 2.2 AA. El reproductor lleva título, los filtros dicen cuál está activo, el carrusel se recorre con teclado y el aviso de "enlace copiado" se anuncia.
- **Idiomas:** ningún texto escrito en los componentes; nombres de fundamentos y niveles en los archivos de traducción (AC-002).
- **SEO:** título, descripción, canónica, `hreflang` e imagen para compartir en el listado y en cada tip. El panel sigue con `noindex`.
- **Portabilidad:** nada exclusivo de Railway (NFR-011).
- **Dependencias nuevas de ejecución:** `tus-js-client`, para la subida reanudable desde el navegador que pide Bunny. Ver la decisión 8.
- **Variables nuevas:** el id de la librería de Bunny Stream, su llave de API y el dominio de su zona. Se declaran en `.env.example`, `src/lib/env.server.ts` y `docs/entornos.md`.
- **Documentos que cambian al aprobar:** `docs/modelo-de-datos.md` (fundamento y nivel como listas fijas, la tabla de vistas por día en vez de `views_week`, y `related_catalog_item_id` pasa a W14) y `docs/plan-maestro.md` (estado de la épica).

## 9. Decisiones y preguntas abiertas

Camilo respondió el 28 de noviembre de 2026: hay 105 videos con título y la lista crece; un solo listado con el fundamento como filtro; contador propio de vistas; y el audio es en español. Ese mismo día decidió dejar por fuera los subtítulos y la publicación en redes desde el panel, y usar una librería de Bunny de pruebas dentro de la misma cuenta. La voz en otros idiomas queda para después. Lo demás quedó como estaba propuesto. Camilo aprobó el documento ese mismo día, con las demás decisiones como estaban propuestas.

- [x] **1. Qué se exige para publicar.** Propuesta: título en español, fundamento, nivel y video listo. La frase de logro y las tres claves son opcionales y la página las omite si faltan. Así los 105 se publican clasificándolos, y los textos se completan con el tiempo. La alternativa, exigir las claves, pide escribir 315 frases antes de lanzar. (Camilo)
- [x] **2. Nombres de los fundamentos.** El mockup dice "Colocación". Propuesta: saque, recepción, colocación, ataque, bloqueo y defensa, como lista fija en la base; agregar uno pide una migración. (Camilo)
- [x] **3. Sin avisos de Bunny.** Propuesta: el panel le pregunta a Bunny el estado de un video cuando hace falta (al terminar una subida, al abrir el editor, al publicar), en vez de recibir avisos. Una librería de Bunny solo avisa a una dirección, y staging y producción comparten necesidad. Se ahorra una ruta con firma y un secreto. (Se decide al construir, salvo objeción)
- [x] **4. Miniaturas directas de Bunny Stream.** FR-123 pide que las imágenes pasen por Bunny Optimizer. Las miniaturas de Stream salen de otra zona, que no lo tiene. Propuesta: usarlas tal cual, con su espacio reservado y carga perezosa, y no pagar un segundo Optimizer. Si el LCP no da, se revisa. (Camilo)
- [x] **5. Librería de pruebas.** Local y staging usan una segunda librería de Bunny Stream, en la misma cuenta, con unos pocos videos, para que probar la subida no ensucie la real. Producción usa la librería de los 105. Lo decidió Camilo el 28 de noviembre de 2026. No es otra cuenta ni otra suscripción: Bunny cobra por uso. Las pruebas automáticas nunca llaman a Bunny; usan uno simulado. Crear la librería de pruebas y pasar las llaves de las dos lo hace Camilo.
- [x] **6. Seguridad de las librerías.** Propuesta: en la real, "Allowed domains" con volleytip.com y el dominio de Railway; en la de pruebas, el dominio de staging y `localhost`. En las dos, sin bloquear el acceso directo a archivos, porque las miniaturas se pintan con `<img>`. Lo configura Camilo. (Camilo)
- [x] **7. Dirección fija tras publicar.** Propuesta: la dirección de un tip no cambia después de la primera publicación, para no romper enlaces compartidos. (Se decide al construir, salvo objeción)
- [x] **8. Dependencia `tus-js-client`.** Bunny pide el protocolo TUS para subir desde el navegador con reanudación. Propuesta: usar esa librería, que es la de referencia del protocolo. (Camilo)
- [x] **9. Promo en L1.** Propuesta: el bloque de promoción ofrece la app y las redes. Camp y producto los agregan W8 y W5. La columna `related_catalog_item_id` no se crea aquí. (Se decide al construir, salvo objeción)
- [x] **10. Carga inicial en producción.** Los 105 tips se importan y clasifican en el panel de producción antes del cambio de DNS. Queda anotado para la lista de verificación de W13. (Camilo y Andrés)
- [x] **11. Nombres de los filtros en la dirección.** Propuesta: los valores van en el idioma de la página (`?fundamento=recepcion` y `?skill=reception`), y un enlace en un idioma lleva a su equivalente en el otro. (Se decide al construir, salvo objeción)
- [x] **12. Tamaño máximo del video.** Propuesta: 500 MB, que cubre de sobra un video corto de celular. (Se decide al construir, salvo objeción)

## 10. Descomposición en tickets (para write-ticket)

Los 12 tickets cuelgan de la épica #4 y se crearon el 28 de noviembre de 2026 como #151 a #162, en el orden de la tabla. El 1 y el 11 crean tablas, que es área de revisión humana (RLS). Ninguno lleva auto-merge: los demás publican contenido o usan una llave secreta. El ticket de listar y editar tips en el panel era tamaño L y se partió en dos: el 3 y el 4.

| #   | Issue | Título                                                     | RF          | Tamaño | Depende de | Auto-merge sugerido                          |
| --- | ----- | ---------------------------------------------------------- | ----------- | ------ | ---------- | -------------------------------------------- |
| 1   | #151  | Crear las tablas de tips y la vista de lectura para la app | RF-1        | M      | ninguna    | No: migración con RLS                        |
| 2   | #152  | Conectar el servidor con Bunny Stream                      | RF-8, RF-10 | S      | ninguna    | No: llave secreta; pide las llaves de Camilo |
| 3   | #153  | Listar los tips en el panel y crear un borrador            | RF-7        | M      | 1          | No: crea contenido                           |
| 4   | #154  | Editar un tip por idioma, programarlo y publicarlo         | RF-7        | M      | 3          | No: publica contenido                        |
| 5   | #155  | Importar los videos de Bunny como tips en borrador         | RF-8        | M      | 1, 2, 3    | No: crea contenido en lote                   |
| 6   | #156  | Clasificar y publicar tips desde la lista                  | RF-9        | S      | 4          | No: publica contenido                        |
| 7   | #157  | Subir un video a Bunny desde el panel                      | RF-10       | M      | 2, 4       | No: firma subidas con una llave secreta      |
| 8   | #158  | Construir el listado público de tips                       | RF-2        | M      | 1          | No: pide aceptar capturas nuevas             |
| 9   | #159  | Construir la página de un tip con su reproductor           | RF-3        | M      | 1, 8       | No: pide aceptar capturas nuevas             |
| 10  | #160  | Compartir un tip y recorrerlo desde el celular             | RF-4, RF-5  | M      | 9          | No: pide aceptar capturas nuevas             |
| 11  | #161  | Contar las vistas y mostrar lo más visto de la semana      | RF-6        | M      | 8, 9       | No: migración con RLS y escritura sin sesión |
| 12  | #162  | Mostrar los tips en la home y buscarlos desde la 404       | RF-11       | S      | 8          | No: cambia la home                           |

Carril de migraciones: llevan migración el 1 y el 11. Van en la misma fila que las de W11a, y cada ticket lleva un `blocked-by` al anterior de la fila: el 1 espera a #130, y el 11 espera al ticket 9 de W11a (#171).

Orden sugerido: el 1 y el 2 primero; no se pisan. Después dos carriles: panel (3, 4, 5, 6, 7) y sitio (8, 9, 10, 11, 12). El carril del sitio se prueba con tips sembrados y no espera al panel. El 7 lleva prioridad baja: Andrés publica primero en redes, así que subir desde la cancha puede ir de último. Todos llevan la etiqueta `carril:tips`.

Tickets que necesitan a Camilo: el 2 (crear la librería de pruebas, pasar las llaves de las dos y configurar los dominios permitidos) y, fuera de los tickets, la carga inicial con Andrés.

Con `ui-review`: tickets 3, 4, 5, 7, 8, 9 y 10. Los demás reutilizan lo que esos dejan.

Cruces con otras épicas:

- **W10a (#5):** el 3 agrega "Tips" al menú del panel y el 7 agrega "Subir tip" a la barra inferior. Chocan en los mismos archivos que #130 y que los tickets 5 y 6 de W11a: van de a uno.
- **W3 (#3):** el 12 completa la home y la 404 que W3 dejó a medias, y la política de privacidad nombra el reproductor de Bunny.
- **W13 (#8):** su `sitemap.xml` incluye los tips, y su lista de verificación incluye la carga inicial.
- **W8 (#14), W5 (#9) y W14 (#16):** agregan camp, producto y paquete digital al bloque de promoción.
- **La app:** lee `public_tips`. Cambiar esa vista después es un cambio que la rompe.
