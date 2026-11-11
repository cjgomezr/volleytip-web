# Diseño — VolleyTip.com

Mockups del rediseño, exportados del lienzo "VolleyTip — Rediseño web" el 11 de noviembre de 2026.
Requisitos: `docs/SRD-volleytip-web-v1.4.md`. Orden de construcción: `docs/plan-maestro.md`.

## Qué hay en esta carpeta

| Carpeta | Contenido |
| --- | --- |
| `*.png` (esta misma carpeta, `docs/mockups/`) | Un PNG por pantalla y por estado. Es la referencia visual para construir y para comparar con Playwright |
| `source/` | El código de cada mockup (`.dc.html`) con `support.js`. Sirve para leer medidas, colores y textos exactos, y para abrir la pantalla en el navegador |
| `assets/` | Logo e imágenes que usan los mockups |

## Cómo usar los PNG

- **Computador:** capturas a 1440 px de ancho, escala 1, página completa.
- **Celular:** capturas a 390 px de ancho, escala 2 (el PNG mide 780 px), página completa.
- El nombre es `<Pantalla>--<estado>.png`. Una pantalla sin estados es `<Pantalla>.png`.
- Para comparar con Playwright, usa el mismo ancho y la misma escala, y `fullPage: true`.
- Los textos entre corchetes (`[PRECIO]`, `[Ciudad]`) son datos que aún no existen: no se copian tal cual.

## Cómo abrir un mockup en el navegador

Desde esta carpeta: `python3 -m http.server 8000` y abrir `http://localhost:8000/source/<Pantalla>.dc.html`. Necesita internet para las fuentes (Anton y Archivo, de Google Fonts). Las pantallas con estados tienen botones que los cambian.

## Reglas

- Los mockups mandan en lo visual; el SRD manda en el comportamiento. Si se contradicen, gana el SRD.
- Una pantalla sin mockup de celular se construye desde el de computador y `design-system.md`.
- Las pantallas marcadas como viejas no se construyen: están por referencia de estilo.
- Marca: `#FC0035`, `#221761`, `#140A35`, `#CDF980`, `#D9E6E8`; títulos en Anton, texto en Archivo.

## Pantallas

| Pantalla | Qué es | Ancho | Epic | Capturas | Notas |
| --- | --- | --- | --- | --- | --- |
| `Main` | A · Transmisión deportiva | 1440 | W3 | `Main.png` |  |
| `Tips` | Tips · listado | 1440 | W4 | `Tips.png` |  |
| `Tip` | Tip · detalle | 1440 | W4 | `Tip.png` |  |
| `Tienda` | Tienda · catálogo | 1440 | W5 | `Tienda.png` |  |
| `Producto` | Tienda · producto y carrito | 1440 | W5 | `Producto.png` | El carrito lateral de esta pantalla es anterior al carrito único; manda `Carrito` |
| `Camps` | Camps · listado | 1440 | W8 | `Camps.png` |  |
| `Camp` | Camp · detalle e inscripción | 1440 | W8 | `Camp.png` | **Parcialmente viejo:** la inscripción aparece dentro de la página; ahora se hace desde el carrito único (FR-039) |
| `Galeria` | Camp pasado · galería descargable | 1440 | W12 | `Galeria.png` | Fase 2 |
| `Nosotros` | Nosotros · la marca | 1440 | W3 | `Nosotros.png` |  |
| `Contacto` | Contacto | 1440 | W3 | `Contacto.png` |  |
| `App` | App · descarga y lista de espera | 1440 | W3 | `App--lista-de-espera.png`, `App--disponible.png` |  |
| `Rutina` | Rutina compartida (enlace desde la app) | 1440 | — | `Rutina.png` | A futuro: aplica cuando exista la app (FR-055). En la fase 1 la ruta muestra "Próximamente" (FR-080) |
| `Checkout` | Tienda · checkout y confirmación | 1440 | W6b | `Checkout--formulario.png`, `Checkout--confirmado.png` | **Viejo:** muestra envío Estándar/Express y no tiene jugadores ni confirmación de correo. Lo reemplaza `Carrito` |
| `Tiquete` | Camp · tiquete QR | 1440 | W9 | `Tiquete--aprobado.png`, `Tiquete--pendiente.png` |  |
| `CheckIn` | Camp · check-in (staff, celular) | 390 | W9 | `CheckIn--pin.png`, `CheckIn--dentro.png` |  |
| `Admin` | Admin · panel para Andrés | 1440 | W10a, W10b | `Admin.png` | Falta la sección de productos digitales y la del VBall Tour |
| `Errores` | Errores: 404, 500, mantenimiento, pago rechazado | 1440 | W3 | `Errores.png` |  |
| `HomeMovil` | Home · celular | 390 | W3 | `HomeMovil.png` |  |
| `TipMovil` | Tip · celular | 390 | W4 | `TipMovil.png` |  |
| `TiendaMovil` | Tienda · celular | 390 | W5 | `TiendaMovil--cerrados.png`, `TiendaMovil--abiertos.png` |  |
| `ProductoMovil` | Producto · celular | 390 | W5 | `ProductoMovil--cerrado.png`, `ProductoMovil--abierto.png` |  |
| `CheckoutMovil` | Checkout · celular | 390 | W6b | `CheckoutMovil--formulario.png`, `CheckoutMovil--confirmado.png` | **Viejo:** lo reemplaza `CarritoMovil` |
| `CampMovil` | Camp · celular | 390 | W8 | `CampMovil.png` | **Parcialmente viejo:** inscripción fuera del carrito |
| `MiTiquete` | Mi tiquete y recuperar · celular | 390 | W9 | `MiTiquete--tiquete.png`, `MiTiquete--tiquete-dia-1-usado.png`, `MiTiquete--recuperar.png`, `MiTiquete--enviado.png` |  |
| `AdminLogin` | Admin · entrar | 1440 | W10a | `AdminLogin.png` |  |
| `Correos` | Correos automáticos | 2000 | W11a, W11b, W9 | `Correos.png` | Faltan los correos nuevos (compra digital, código, reembolso, cupo cedido, Tour) |
| `AdminMovil` | Admin · celular (Andrés) | 390 | W10a | `AdminMovil--inicio.png`, `AdminMovil--pedidos.png`, `AdminMovil--subir.png`, `AdminMovil--camps.png`, `AdminMovil--mas.png` |  |
| `DigitalMovil` | Producto digital · celular | 390 | W14 | `DigitalMovil.png` |  |
| `LeccionMovil` | Lección (reproductor) · celular | 390 | W14 | `LeccionMovil.png` |  |
| `MisCompras` | Mis compras: entrar, código y lista · celular | 390 | W14 | `MisCompras--mis-compras.png`, `MisCompras--entrar.png`, `MisCompras--codigo.png` |  |
| `CarritoMovil` | Carrito único, checkout y "¿Este es tu correo?" · celular | 390 | W6a, W6b | `CarritoMovil--carrito.png`, `CarritoMovil--checkout.png`, `CarritoMovil--confirmar-correo.png`, `CarritoMovil--confirmado.png` |  |
| `CederCupo` | Ceder cupo · celular | 390 | W9 | `CederCupo--formulario.png`, `CederCupo--cedido.png` |  |
| `Liquidacion` | Admin · liquidación del club | 1440 | W8 | `Liquidacion.png` |  |
| `Digital` | Producto digital | 1440 | W14 | `Digital.png` |  |
| `Leccion` | Lección (reproductor) | 1440 | W14 | `Leccion.png` |  |
| `MisComprasWeb` | Mis compras: lista, entrar y código | 1440 | W14 | `MisComprasWeb--mis-compras.png`, `MisComprasWeb--entrar.png`, `MisComprasWeb--codigo.png` |  |
| `Carrito` | Carrito único, checkout y "¿Este es tu correo?" | 1440 | W6a, W6b | `Carrito--carrito.png`, `Carrito--checkout.png`, `Carrito--confirmar-correo.png`, `Carrito--confirmado.png` |  |
| `CederCupoWeb` | Ceder cupo | 1440 | W9 | `CederCupoWeb--formulario.png`, `CederCupoWeb--cedido.png` |  |
| `VBallTour` | VBall Tour · página, asistencia y aliados | 1440 | W15 | `VBallTour--pagina.png`, `VBallTour--asistencia-confirmada.png`, `VBallTour--aliado-enviado.png` |  |
| `VBallTourMovil` | VBall Tour · celular | 390 | W15 | `VBallTourMovil--pagina.png`, `VBallTourMovil--asistencia-confirmada.png`, `VBallTourMovil--aliado-enviado.png` |  |

## Diferencias conocidas con el SRD (manda el SRD)

Pendiente P-24 del SRD. Hasta que el diseño se corrija, estas partes de los mockups no se construyen como se ven:

| Pantalla | Qué cambia | Requisito |
| --- | --- | --- |
| Todas las que tienen header | El menú es uno solo: Tips, Camps, VBall Tour, Tienda, App, Nosotros, más idioma, ícono de "Mis compras" y carrito. Los mockups muestran tres variantes | FR-002 |
| `Carrito`, `CarritoMovil` | El campo dice "Código de club o de descuento": solo es código de club. Falta el tipo de documento junto al número. Falta la casilla opcional del recordatorio de carrito | FR-024, FR-102 |
| `CheckIn` | El resultado muestra "Menor de edad": el staff no ve ese dato. La búsqueda es por nombre del jugador o WhatsApp del comprador | FR-048, FR-049 |
| `VBallTour`, `VBallTourMovil` | "Te recordamos el día antes por WhatsApp o correo": solo hay recordatorio por correo, y solo si lo dejaron | FR-131 |
| `CederCupo`, `CederCupoWeb` | Falta pedir el código de 6 dígitos al correo del comprador cuando no hay sesión de "Mis compras" | FR-119 |

## Lo que falta diseñar

- Sección de productos digitales en el admin (W14).
- Paradas, asistentes y aliados del VBall Tour en el admin (W15).
- Versión actualizada de la inscripción en la página del camp (W8).
- Correos nuevos: compra digital, código de acceso, reembolso, cupo cedido y los del Tour.
- Página de preguntas frecuentes (W3).
- Versión de celular de Tips (listado), Camps (listado), Nosotros, Contacto, App y páginas legales. No bloquea.
