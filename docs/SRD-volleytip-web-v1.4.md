# SRD — VolleyTip.com (v1.4)

| | |
| --- | --- |
| **Versión** | 1.4, del 11 de noviembre de 2026. Corrige las contradicciones y los vacíos encontrados al revisar la v1.3 antes de crear el repositorio (sección 17). Reemplaza a las versiones anteriores |
| **Producto** | volleytip.com: sitio público, tienda (física y digital), camps y admin |
| **Autor** | Camilo Gómez Restrepo |
| **Fuentes** | Lienzo de mockups "VolleyTip — Rediseño web" (40 pantallas, en computador y celular): https://claude.ai/artifact/XD5snpBSnmXk1kT74Wv1MU · PDF del Volleyball Camp · decisiones de noviembre de 2026 |
| **Estado** | Listo para empezar el desarrollo. Lo que falta por definir está en la sección 16 y no bloquea el arranque |
| **Siguiente paso** | Plan maestro con epics → PRD por epic → tickets |

## Cómo leer este documento

- **Los identificadores no cambian.** Cada requisito conserva su número (FR-024, AC-041…) aunque el documento se reorganice, para poder citarlos en el plan, los PRD y los tickets. Por eso los números no siempre van en orden dentro de una sección.
- **FR** es un requisito funcional (qué hace el sistema), **BR** un requisito de negocio, **AC** un criterio de aceptación (cómo se comprueba), **US** una historia de usuario.
- **Fases.** Fase 1 es lo que se construye ahora. Fase 2 y fase 3 están descritas para no cerrarles el camino, pero no se construyen todavía. "A futuro" significa sin fecha.
- **Los valores entre corchetes** (por ejemplo \[N\] días) son datos que aún no existen; casi todos se configuran en el admin y no bloquean el desarrollo.
- Si dos partes del documento parecen contradecirse, manda la sección 1.1 (decisiones clave).

## 1. Resumen ejecutivo

**Problema.** La web actual casi no se usa, depende de Strapi y de dos servidores costosos en DigitalOcean, y no vende ni inscribe en línea. La audiencia (116K en Instagram, 530K en TikTok, sobre todo de Colombia y Suramérica) no tiene un lugar propio donde ver los tips, comprar o inscribirse a un camp.

**Objetivo.** Reconstruir volleytip.com como la ventana de VolleyTip, con un fin principal: **que comprar sea fácil**. En un solo carrito y un solo pago se compran ropa y accesorios, productos digitales (paquetes de videos con guías y descargables) y cupos para los Volleyball Camps. Alrededor de la venta viven los tips gratis que atraen a la audiencia y un admin propio para Andrés que reemplaza a Strapi.

**Resumen de alcance.** La fase 1 entrega el sitio completo en español e inglés, para vender en Colombia con Wompi, con la estructura de idiomas y mercados lista para portugués y otros países. La factura electrónica y las galerías quedan para después, con el camino preparado.

### 1.1 Decisiones clave

| Tema | Decisión |
| --- | --- |
| Prioridad | Vender. Todo el contenido lleva a un producto, un paquete digital o un camp |
| Compra | Un solo carrito y un solo pago para físicos, digitales y cupos de camp. Sin crear cuenta |
| Cuentas | Sin contraseñas. El correo es la llave: se entra a "Mis compras" con un código o enlace enviado al correo |
| Productos digitales | Paquetes de 10–20 videos (Bunny Stream) con guías y descargables, y descargables sueltos. La sección se oculta mientras no haya ninguno publicado |
| Pagos | Wompi, en COP. Cuenta a nombre de una persona natural. Wompi no divide pagos |
| Camps | Precio y parte del club definidos por camp. VolleyTip cobra todo y le transfiere al club después del camp |
| Cancelación de camps | 100% hasta 8 días antes; después solo se puede ceder el cupo (pendiente de revisión legal) |
| Envíos | Solo Colombia. Tarifa fija por zona, gratis desde $200.000 en productos físicos. Despacho manual con plataforma que recoge |
| Reembolsos | Botón en el admin; el dinero se devuelve a mano en la fase 1 |
| Factura electrónica | Fuera de la fase 1. Módulo apagado y datos preparados |
| Otras monedas | Fase 1 solo COP. Los productos digitales muestran siempre el precio en COP y debajo un aproximado en dólares, con una tasa que se escribe a mano en Ajustes |
| Hosting | Railway Hobby para arrancar; pasar a Vercel si hace falta |
| Analítica | Ninguna en la fase 1 |
| Imágenes y video | Bunny Optimizer para imágenes; Bunny Stream para video |
| VBall Tour | Evento social gratuito. Página propia con registro de asistencia (solo para planear) y formulario de aliados. La web no recibe donaciones en dinero |
| App móvil | No se construye ahora; la web deja preparado el backend, las cuentas y los enlaces |

### 1.2 Glosario

| Término | Significado |
| --- | --- |
| Cupo | Un puesto para un jugador en un camp. Se compra como un ítem más del carrito |
| Plan | Variante de un cupo: "Ingreso" o "Ingreso + camiseta" |
| Código de club | Código que un club reparte a sus jugadores cuando prepagó cupos de un plan; deja en $0 un cupo de ese plan |
| Parte del club | Valor por cupo vendido en venta directa que VolleyTip le transfiere al club anfitrión |
| Liquidación | Cálculo de cuánto se le debe transferir al club después de un camp |
| Paquete digital | Conjunto de lecciones en video con guías y archivos descargables |
| Mis compras | Página privada del comprador con sus paquetes, tiquetes y pedidos |
| Mercado | País + moneda + reglas de envío y pago. En la fase 1 solo existe Colombia |
| Tiquete | Entrada al camp con QR, una por jugador, válida una vez por día |
| Parada | Cada fecha y lugar del VBall Tour. Es gratis y no tiene cupos ni tiquetes |

## 2. Interesados

| Interesado | Rol | Interés |
| --- | --- | --- |
| Camilo Gómez | Dueño de producto y desarrollador | Web mantenible, barata, construida con Claude Code |
| Andrés Piza | Operación y contenido | Publicar tips, despachar pedidos, manejar camps y productos digitales sin depender del desarrollo |
| Compradores | Usuarios | Comprar fácil desde el celular y ver su contenido digital enseguida |
| Participantes de camps y acudientes | Usuarios | Inscribirse, pagar y entrar con el tiquete |
| Clubes anfitriones | Socios | Llevar un camp a su ciudad, recibir su parte o prepagar cupos |
| Staff de check-in | Usuarios temporales | Escanear tiquetes con su celular |
| Wompi, Bunny, Resend | Proveedores | Pagos, video e imágenes, correo |

## 3. Alcance

### 3.1 Dentro del alcance (fase 1)

- Sitio público bilingüe (computador y celular): home, tips, detalle de tip, nosotros, contacto, página de la app con lista de espera, páginas de error y legales.
- Tienda física: catálogo, producto, inventario por color y talla, envíos en Colombia con tarifa por zona.
- Productos digitales: página de producto, "Mis compras" con acceso por correo, reproductor de lecciones protegido y descargables con marca.
- Carrito único y checkout como invitado con Wompi.
- Camps: listado, detalle, inscripción desde el carrito con venta directa o código de club, tiquete QR, ceder cupo, recuperación de tiquete, check-in con PIN y liquidación del club. VBall Tour: página del evento, registro de asistencia gratuito y formulario de aliados.
- Admin: tips, productos, productos digitales, pedidos y reembolsos, camps, mensajes, textos, idiomas y mercados, equipo. En celular: despachar pedidos, subir tips y manejar el camp.
- Correos automáticos.
- Reemplazo de la web actual y preparación para la app.

### 3.2 Fases siguientes

| Fase | Qué incluye |
| --- | --- |
| Fase 2 | Galerías descargables de camps, admin de celular completo, cotización de envío y guía automática por API, estados de entrega "preparando" y "entregado", anulación con tarjeta por la API de Wompi, traducción del contenido existente, subtítulos |
| Fase 3 | Otros países y monedas para productos digitales (segunda pasarela), conversión automática de precios por mercado (FR-010), portugués |
| A futuro | Factura electrónica (cuando el contador lo indique o se superen los topes), cupones de descuento, herramienta de analítica, rutina compartida de la app |

### 3.3 Fuera del alcance

- Cuentas con contraseña para compradores.
- Comunidad, comentarios o foros en los productos digitales.
- Migración de datos de Strapi (solo se rescatan fotos) y redirecciones de la web actual.
- Envío de productos físicos fuera de Colombia.
- Cualquier función de la app móvil.

### 3.4 Relación con la app móvil

La app de VolleyTip se reconstruirá después de la web y no forma parte de esta entrega. La web deja preparadas las piezas que la app va a necesitar para no rehacer trabajo: el mismo backend, las cuentas, el contenido bilingüe, los videos y los enlaces de rutinas (sección 6.17). La app adoptará la misma identidad visual de la web.

## 4. Roles de usuario

| Rol | Quién es | Qué puede hacer |
| --- | --- | --- |
| Visitante | Cualquiera, sin sesión | Ver contenido, comprar, inscribirse, escribir por contacto, ver su tiquete por enlace privado |
| Comprador con sesión | Quien entró a "Mis compras" con el código o enlace de su correo | Ver sus paquetes digitales, descargables, tiquetes y pedidos; ceder un cupo sin pedir otro código (FR-119); cerrar sesión |
| Admin | Andrés y Camilo | Todo el panel `/admin` |
| Staff de check-in con cuenta | Persona del equipo invitada con ese rol | Solo el escáner del evento asignado |
| Staff por enlace | Voluntario o personal del club, sin cuenta | Solo el escáner de un evento, con enlace + PIN y en las fechas del camp |

## 5. Requisitos de negocio

| ID | Requisito |
| --- | --- |
| BR-001 | Vender es el objetivo principal del sitio: toda página de contenido (home, tips, nosotros) lleva a un producto, un paquete digital o un camp. |
| BR-002 | Ropa, accesorios, productos digitales y cupos de camp se compran en un mismo carrito, con un solo checkout y un solo pago, sin crear cuenta antes. |
| BR-003 | VolleyTip vende los cupos de sus camps en su propia web para controlar inscritos, pagos y check-in. |
| BR-004 | En cada Volleyball Camp el precio al público y la parte del club se definen por camp (FR-116). VolleyTip cobra todo y después le transfiere al club su parte (FR-117). Como referencia, hasta ahora VolleyTip ha recibido $70.000 COP por participante; ese valor ya no es fijo. |
| BR-005 | VolleyTip vende productos digitales: paquetes de 10–20 videos con guías y descargables, y descargables sueltos (PDF, planes). El acceso es permanente para el comprador y no se puede compartir fácilmente. |
| BR-006 | El envío es gratis en Colombia desde $200.000 COP de compra en productos físicos. |
| BR-007 | La factura electrónica no hace parte de la fase 1: VolleyTip opera a nombre de una persona natural por debajo de los topes (sección 6.15). El sistema queda preparado para activarla sin rehacer el checkout. |
| BR-008 | La fase 1 vende en Colombia y cobra en COP con Wompi (cuenta a nombre de una persona natural del equipo). Los productos físicos solo se envían a Colombia; los productos digitales se pueden comprar desde cualquier país con tarjeta. |
| BR-009 | La web es bilingüe desde el lanzamiento; el español es obligatorio en todo contenido. |
| BR-010 | Los tips son gratuitos y públicos y funcionan como vitrina de los productos digitales y los camps. |
| BR-011 | El costo mensual de infraestructura es de unos US$45–50 al arrancar (Railway Hobby, Supabase Pro en producción y plan gratis en pruebas, Bunny Stream, Storage y Optimizer, dominio y Resend gratis), por debajo del costo actual en DigitalOcean. Desde los camps (L3) sube a unos US$65–70, porque Resend pasa al plan de pago: los correos de un camp superan el límite diario del plan gratis. |

## 6. Requisitos funcionales

### 6.1 Navegación

| ID | Requisito |
| --- | --- |
| FR-001 | El sistema mostrará una barra de anuncios con un mensaje editable desde el admin. |
| FR-002 | El sistema mostrará un header con logo, un menú único (Tips, Camps, VBall Tour, Tienda, App, Nosotros), selector de idioma, ícono de "Mis compras" y carrito con contador; en celular, carrito y un menú a pantalla completa (letra de 30 px, zonas de toque de 48 px, una línea para "Mis compras", idioma y redes al pie). El menú es el mismo en todas las páginas: los mockups muestran tres variantes y manda esta lista. |
| FR-003 | El sistema mostrará un pie con íconos oficiales de TikTok, Instagram, YouTube, Facebook y WhatsApp (+57 314 648 6275), enlaces (entre ellos "Mis compras" y preguntas frecuentes, FR-137), idioma y línea legal. |

### 6.2 Idiomas, mercados y monedas

| ID | Requisito |
| --- | --- |
| FR-004 | El sistema servirá el español sin prefijo y el inglés bajo `/en/`, con `hreflang` y `lang` correctos, y aceptará nuevos idiomas (por ejemplo `/pt/`) agregando filas y traducciones. |
| FR-005 | El sistema propondrá el idioma del navegador en la primera visita y guardará la elección manual en una cookie, conservando la página al cambiar. |
| FR-006 | El sistema leerá todo texto fijo de archivos de traducción; ningún texto visible quedará escrito en los componentes. |
| FR-007 | El sistema mostrará el contenido traducido por campo y, si falta, en español. |
| FR-008 | El sistema enviará correos y tiquetes (y facturas, cuando se active ese módulo) en el idioma del comprador, y formateará fechas y números por idioma. |
| FR-009 | El sistema manejará mercados (país, moneda, idioma por defecto, envío, medios de pago, activo). Solo los activos aparecen en "Envío a". Idioma y mercado son independientes. En la fase 1 solo hay un mercado activo: Colombia (COP); los productos físicos solo se envían a Colombia. |
| FR-010 | El sistema guardará un precio base en COP por producto y un precio por mercado fijado a mano, como enteros en la unidad menor de la moneda. El modo automático (conversión diaria y redondeo) pasa a la fase 3. |
| FR-011 | El sistema guardará en cada pedido mercado, moneda, idioma y precios del momento de la compra. |
| FR-122 | Monedas, fase 1: todo se cobra en COP con Wompi. Los productos digitales muestran siempre el precio en COP y, debajo, un aproximado en dólares ("≈ US$12") con la nota de que el cobro es en pesos colombianos. La tasa es un valor que el admin escribe en Ajustes: no hay detección de país ni servicio de tasas. Cobrar en otras monedas (Merchant of Record o Stripe) queda para una fase posterior y solo para productos digitales. |

### 6.3 Home y tips

| ID | Requisito |
| --- | --- |
| FR-012 | La home mostrará héroe "Aprende voley en 60 segundos" con botón a tips y redes, último video destacado, cifras editables, fundamentos con conteo, próximos eventos (o invitación a avisar si no hay), 4 productos destacados y bloque de nosotros. |
| FR-013 | El listado de tips permitirá filtrar por fundamento y nivel (combinables y en la URL), buscar por texto, ver el último y los más vistos de la semana, y cargar de 20 en 20. |
| FR-014 | El detalle de tip mostrará el reproductor de Bunny en formato vertical u horizontal, título, frase de logro, 3 claves, "Error común" y "Practícalo" opcionales, anterior y siguiente del mismo fundamento, tips relacionados y un bloque de promoción configurable (camp, producto, app o redes). |
| FR-015 | El sistema permitirá compartir un tip (menú nativo en celular, copiar enlace en computador) y mostrará "Ver en TikTok" si tiene enlace. |
| FR-016 | En celular, el tip tendrá una barra fija con Anterior, Compartir y Siguiente, y los relacionados en carrusel. |
| FR-017 | El sistema permitirá asociar a tips los videos que ya existen en Bunny Stream mediante una importación asistida en el admin. |

### 6.4 Tienda física y envíos

| ID | Requisito |
| --- | --- |
| FR-018 | El catálogo permitirá filtrar por público, categoría y talla, y ordenar por novedad y precio; en celular los filtros van en un panel inferior. |
| FR-019 | El sistema mostrará insignias Nuevo, Últimas unidades (bajo el umbral) y Agotado. |
| FR-020 | El producto tendrá galería por color, selector de color y talla; las tallas sin stock se ven tachadas con "Avísame cuando vuelva", que guarda correo e idioma. |
| FR-021 | El producto mostrará hasta 4 relacionados ("Combínalo con"), elegidos en el admin o de la misma categoría; los accesorios sin talla se agregan con un toque. |
| FR-023 | El sistema validará el stock al agregar y otra vez antes de cobrar, y avisará si algo se agotó. |
| FR-120 | Envíos, fase 1: solo a Colombia. El cliente paga el envío con una tarifa fija por zona (por ejemplo, ciudad de origen y resto del país), con zonas, valores y tiempos estimados editables en el admin; gratis cuando el subtotal de productos físicos llega a $200.000 (umbral editable). El despacho es manual con una plataforma multitransportadora que recoge en la dirección de VolleyTip (Envia.com o Mipaquete, por elegir); el admin registra transportadora y número de guía y eso dispara el correo "Tu pedido va en camino". Fase 2: cotización por ciudad y guía automática por API. |

### 6.5 Carrito único

El carrito es uno solo para todo lo que vende VolleyTip. Mockup: "Carrito único, checkout y ¿Este es tu correo?".

| ID | Requisito |
| --- | --- |
| FR-022 | El carrito se abrirá al agregar (lateral en computador, panel inferior en celular), se conservará 30 días en el navegador y mostrará cuánto falta para el envío gratis. |
| FR-095 | El carrito aceptará productos físicos, productos digitales y cupos de camp al mismo tiempo, agrupados por tipo, con un solo total y un solo pago. |
| FR-096 | Un cupo de camp se agrega al carrito desde la página del camp eligiendo plan; los datos de cada jugador (y de su acudiente si es menor) se piden en el checkout, uno por cupo. |
| FR-097 | El código de club se aplica en el carrito a un cupo del plan que ese código cubre (FR-037) y lo deja en $0; cada uso vale para un solo cupo y el resto del carrito se paga normal. |
| FR-098 | El checkout es una sola página y solo muestra las secciones que el carrito necesita: envío si hay físicos, datos de jugadores si hay cupos, ninguna extra si solo hay digitales. |
| FR-099 | Al iniciar el pago se reservan stock, cupos y cupos de código de club por 30 minutos; si Wompi reporta la transacción como pendiente, la reserva se conserva hasta que se apruebe o se rechace (FR-029). Si algo ya no está disponible, se avisa antes de cobrar y se puede seguir con el resto. |
| FR-100 | Con el pago aprobado, un mismo pedido dispara cada entrega: envío de físicos, acceso digital y emisión de tiquetes (y una sola factura, si ese módulo está encendido); la confirmación muestra lo que pasa con cada parte. |
| FR-101 | El carrito mostrará sugerencias para completar la compra (paquete digital relacionado con el camp o el tip visto, accesorios) sin interrumpir. |
| FR-102 | Un carrito sin pagar se guardará 30 días en el navegador. Junto al correo, en "Tus datos", habrá una casilla opcional para aceptar un recordatorio del carrito; solo quien la marca recibe un único recordatorio a las 24 horas, con opción de no recibir más. |

### 6.6 Checkout y pagos

El pago siempre pasa por Wompi, salvo cuando el total es $0 por un código de club (FR-039).

| ID | Requisito |
| --- | --- |
| FR-024 | El checkout es una sola página con hasta cuatro secciones y solo muestra las que el carrito necesita (FR-098): (1) Tus datos: correo, nombre completo, WhatsApp, tipo y número de documento (opcionales, FR-125) y la casilla del recordatorio (FR-102); (2) Jugadores, uno por cupo de camp (FR-038); (3) Envío, solo si hay productos físicos: departamento, ciudad, dirección y la tarifa de la zona (FR-120); (4) Pago: resumen por ítem, código de club, política de cancelación del camp si aplica y aceptación de términos, cambios y reembolsos y tratamiento de datos. El mockup "Carrito" no muestra el tipo de documento y sí un campo "de descuento" que no se construye en la fase 1 (pendiente P-24). |
| FR-025 | Al pagar, el sistema creará el pedido como pendiente con referencia única y firma de integridad generada en servidor, y abrirá el widget de Wompi (tarjeta, PSE, Nequi, Botón Bancolombia; fuera de Colombia, solo tarjeta). |
| FR-026 | El sistema cambiará el estado del pago solo con el evento de Wompi verificado por firma, de forma idempotente. |
| FR-027 | Con pago aprobado el sistema marcará el pedido pagado, descontará stock y cupos en una transacción, disparará cada entrega (FR-100) y enviará la confirmación; pedirá la factura solo si ese módulo está encendido (FR-127). Con rechazo marcará fallido y liberará las reservas. |
| FR-028 | La página de regreso mostrará confirmación, "pago en proceso" o "pago rechazado" con opción de reintentar. |
| FR-029 | El pedido tendrá dos estados separados. Estado de pago: pendiente, pagado, fallido, expirado, anulado y reembolsado (parcial o total). Estado de entrega, solo para pedidos con productos físicos: por enviar y enviado ("preparando" y "entregado" pasan a la fase 2). Un pedido pendiente expira a los 30 minutos solo si no se inició un pago; mientras Wompi reporte su transacción como pendiente (por ejemplo un PSE lento) no expira y conserva stock y cupos hasta quedar aprobado o rechazado. Si un pago se aprueba después de expirar, el pedido se reactiva si aún hay stock y cupos; si no, queda con alerta en el admin para reembolso. |
| FR-030 | En celular el resumen del pedido se pliega arriba y el botón Pagar queda fijo abajo. |
| FR-107 | Si el carrito tiene un producto digital o un cupo de camp, al pulsar Pagar y antes de ir a Wompi saldrá la ventana "¿Este es tu correo?" con el correo en letra grande, un texto adaptado ("ahí te llegará el acceso a tu paquete", "tu tiquete" o ambos) y dos botones: "Sí, es correcto · Ir a pagar" y "Corregir" (vuelve al campo del correo con el foco). Si el carrito solo tiene productos físicos no sale la ventana; el resumen muestra "Te enviaremos la confirmación a \[correo\] · Cambiar". |
| FR-108 | Mientras se escribe el correo, el checkout sugerirá la corrección de dominios mal escritos (gmial.com, hotmial.com, gmail.co, outlok.com, etc.) con el texto "¿Quisiste decir …?", que se aplica con un toque. |
| FR-125 | El checkout pedirá desde la fase 1 los datos que una factura necesita: nombre completo o razón social, tipo y número de documento (opcional mientras la factura esté apagada, obligatorio al encenderla), correo, ciudad y dirección. Se guardan en el pedido. |
| FR-126 | Cada ítem del pedido guardará por separado el precio sin impuesto, la tarifa de IVA y el valor del IVA (la tarifa se configura por tipo de producto en el admin; en la fase 1 puede ser 0%). Los reembolsos guardan los mismos valores para poder generar notas crédito. |

### 6.7 Camps e inscripción

| ID | Requisito |
| --- | --- |
| FR-035 | El listado mostrará próximos y pasados (los pasados enlazan a su galería), filtro por país, fechas, ciudad, cupos restantes y precio desde; sin próximos, mostrará "Avísame" (correo + ciudad) y el bloque "Organiza un Volleyball Camp" con descarga del PDF. |
| FR-036 | El detalle mostrará póster, fechas, lugar con mapa, cupos con barra (capacidad definida por camp, 150 por defecto), qué incluye, agenda de 2 días, entrenadores, política de cancelación (FR-118) y preguntas frecuentes. |
| FR-037 | Cada camp puede vender de dos formas, que pueden convivir: venta directa (cada participante paga el precio al público del plan con Wompi) y cupos prepagados (el club paga por adelantado N cupos y reparte un código). Cada código de club se crea en el admin con el plan que cubre, el número de cupos y el precio por cupo prepagado acordado; cada uso descuenta un cupo y solo sirve para ese plan. |
| FR-038 | Por cada cupo el checkout pedirá: nombre completo del jugador, fecha de nacimiento, nivel y talla (solo si el plan incluye camiseta). Si el jugador es menor de edad en la fecha del camp, pedirá además nombre y teléfono del acudiente, autorización con deslinde y autorización de uso de imagen. El correo y el WhatsApp son los del comprador. La camiseta del plan se entrega en el camp y no genera envío. |
| FR-039 | La inscripción se hace a través del carrito único (FR-095 a FR-097): el cupo se agrega desde la página del camp y se paga junto con lo demás; si todo el carrito queda en $0 por código de club, el botón final es "Confirmar inscripción" y no pasa por Wompi. |
| FR-040 | El cupo quedará reservado 30 minutos al iniciar el pago (FR-099) y se liberará si no se paga; el conteo de cupos será atómico. |
| FR-041 | El sistema permitirá inscribir varios jugadores con el mismo correo, con un tiquete por jugador. |
| FR-042 | La liquidación con el club se calcula como indica FR-117. Para los cupos prepagados, el admin mostrará por código los cupos comprados, usados y disponibles. |
| FR-116 | Al crear o editar un camp, el admin pedirá: capacidad, planes con su precio al público (por mercado, igual que un producto físico), club anfitrión y parte del club por cupo vendido. Si hay cupos prepagados, el plan y el precio por cupo se definen en cada código de club (FR-037). Nada de esto es fijo: cambia por camp. El VBall Tour es otro tipo de evento, gratuito y sin cupos pagados (sección 6.19). |
| FR-117 | Wompi no divide pagos: todo se cobra a la cuenta de Wompi de VolleyTip. El admin mostrará por camp la liquidación del club (cupos pagados y no reembolsados × parte del club = total a transferir). Después del camp VolleyTip transfiere al club (a mano o con Pagos a terceros de Wompi) y marca la liquidación como pagada con fecha y comprobante; no se puede marcar sin comprobante. Los cupos con código de club prepagado no entran en la liquidación. |
| FR-118 | Política de cancelación de camps (pendiente de revisión legal): reembolso del 100% si se pide 8 días o más antes del primer día; con 7 días o menos no hay reembolso, pero se puede ceder el cupo; si VolleyTip cancela o cambia la fecha, 100% o traslado a la nueva fecha. La política se muestra en la página del camp, en el checkout y en el correo del tiquete. Los días son un valor editable por camp. |

### 6.8 Tiquete, ceder cupo y check-in

| ID | Requisito |
| --- | --- |
| FR-043 | Con pago aprobado o código válido el sistema emitirá un tiquete por jugador con QR que contiene solo un token aleatorio, y lo enviará por correo con PDF. |
| FR-044 | "Mi tiquete" (enlace privado) mostrará el QR, los datos, el estado por día, descarga en PDF y agregar al calendario. Mientras el pago esté pendiente (por ejemplo PSE) todavía no hay tiquete: la pantalla "Estamos confirmando tu pago" pertenece al pedido y se abre con el enlace privado del pedido. |
| FR-045 | "¿Perdiste tu tiquete?" reenviará todos los tiquetes vigentes del correo, con la misma respuesta exista o no. |
| FR-046 | El escáner funcionará en el navegador del celular con la cámara; los admins y el staff con cuenta entran con su cuenta, y el staff por enlace con el enlace del evento + PIN de 4 dígitos (bloqueo 15 min tras 5 intentos). |
| FR-047 | Los enlaces de staff se crearán en el admin, abrirán solo el escáner de su evento en sus fechas, se podrán desactivar y registrarán quién escaneó. |
| FR-048 | Cada tiquete se validará una vez por día en servidor con bloqueo: válido (con nombre del jugador, plan y casilla de camiseta entregada si el plan la incluye), ya ingresó (hora y staff) o no válido. El staff no ve si el jugador es menor de edad ni los datos del acudiente; el mockup "Check-in" muestra "Menor de edad" y eso no se construye (pendiente P-24). |
| FR-049 | El escáner permitirá buscar por nombre del jugador o por WhatsApp del comprador; cada resultado muestra el nombre del comprador y los últimos 4 dígitos de su WhatsApp para distinguir homónimos. No se pide ningún dato nuevo en la inscripción. Mostrará un contador compartido "N de [capacidad]" por día y funcionará sin conexión: el celular descarga los hashes de los tokens del evento (nunca los tokens) junto con lo que el staff puede ver, valida contra esa lista y sincroniza al volver. |
| FR-119 | El tiquete tendrá el botón "Ceder mi cupo", disponible en cualquier momento hasta el día anterior al camp. El enlace del tiquete solo no basta: ceder exige un código de 6 dígitos enviado al correo del comprador, o tener sesión abierta en "Mis compras". Después se escriben los datos del nuevo jugador (FR-038) y el correo donde llega el tiquete, el QR anterior deja de servir, se emite un tiquete nuevo y queda el registro del cambio. Ceder no tiene costo y conserva el plan y la talla ya pedidos. |

### 6.9 Productos digitales y "Mis compras"

El comprador no crea cuenta: su correo es la llave. Al pagar queda registrado que ese correo es dueño del producto; para volver a entrar pide un código que llega a ese correo. Mockups: "Producto digital", "Lección" y "Mis compras".

| ID | Requisito |
| --- | --- |
| FR-083 | El sistema venderá dos tipos de producto digital: **paquete** (10–20 lecciones en video de Bunny Stream organizadas en secciones, con guías y archivos descargables por lección o del paquete) y **descargable** (uno o varios archivos: PDF, planes). |
| FR-084 | La página de un producto digital mostrará portada, video de presentación, qué aprenderás, temario con duración por lección, lecciones de muestra gratis marcadas por el admin, qué descargables incluye, nivel, a quién va dirigido, preguntas frecuentes y precio, con "Agregar al carrito" y "Comprar ahora". |
| FR-085 | Al aprobarse el pago, el sistema dará acceso inmediato y enviará el correo "Tu compra digital" con un enlace que abre "Mis compras" directamente (FR-105). |
| FR-086 | "Mis compras" se abrirá con un enlace o código de 6 dígitos enviado al correo de compra (sin contraseña) y mostrará paquetes y descargables comprados, pedidos físicos con su estado y tiquetes de camp. |
| FR-087 | El reproductor de lecciones mostrará el temario, marcará lecciones vistas, recordará dónde quedó la persona y ofrecerá los descargables de cada lección. |
| FR-088 | Los videos se servirán con URLs firmadas de Bunny Stream que vencen (máximo 6 horas) y restringidas al dominio; los archivos se descargarán con enlaces firmados que vencen en 15 minutos. Ningún archivo de pago tiene una URL pública permanente. |
| FR-089 | Los PDF descargados llevarán una marca con el correo del comprador. |
| FR-090 | El sistema limitará las sesiones simultáneas de "Mis compras" por comprador (por ejemplo 3) y avisará en el admin de un uso anormal. |
| FR-091 | El acceso a un producto digital será permanente; si el admin actualiza el paquete (nuevas lecciones o archivos), los compradores ven la versión nueva. |
| FR-092 | El admin podrá dar acceso manual (regalos, alianzas, clientes de camps) y revocarlo (reembolsos). |
| FR-093 | Los productos digitales tendrán precio por mercado (FR-010) y podrán comprarse desde cualquier país con tarjeta, sin envío. |
| FR-094 | El sistema podrá vender combos: un paquete digital incluido al comprar un producto físico o un cupo de camp (por ejemplo "Camp + paquete de recepción"). |
| FR-103 | El admin tendrá una sección Productos digitales: crear paquete o descargable por idioma, portada, video de presentación, secciones y lecciones (video de Bunny Stream, duración, guía en texto, archivos), lecciones de muestra, archivos en Bunny Storage privado, precio por mercado, combos y estado (borrador, publicado, retirado). |
| FR-104 | El admin mostrará por producto digital las ventas, los compradores con fecha y origen (compra, combo, acceso manual) y el avance promedio de las lecciones. |
| FR-105 | El correo "Tu compra digital" saldrá al aprobarse el pago con un enlace que abre "Mis compras" sin pedir código: sirve una sola vez y vence a las 24 horas. Usado o vencido, lleva a la pantalla de entrada con el correo ya escrito para pedir un código. El código y el enlace que se piden en esa pantalla vencen a los 15 minutos (FR-110). |
| FR-106 | La home, los tips y las páginas de camp mostrarán los productos digitales relacionados (un tip de recepción sugiere el paquete de recepción; el camp sugiere el combo). |
| FR-110 | Para entrar a "Mis compras" se escribe el correo y llega a ese correo un código de 6 dígitos y un enlace de un solo uso (Supabase Auth, enviado con Resend); ambos vencen a los 15 minutos. El enlace del correo "Tu compra digital" tiene su propia regla (FR-105). La pantalla siempre responde lo mismo ("Si ese correo tiene compras, te llegó un código") para no revelar si un correo ha comprado. Recuperar un tiquete sin entrar a "Mis compras" sigue FR-045. |
| FR-111 | Protección contra abuso: 5 intentos fallidos invalidan ese código, nunca bloquean el correo (se puede pedir otro); los intentos también se limitan por dispositivo o IP con una pausa de unos minutos; máximo 5 envíos de código por correo cada hora; el formulario usa Cloudflare Turnstile. Los códigos y enlaces ya enviados siguen sirviendo hasta vencer aunque se llegue al límite. |
| FR-112 | La sesión de "Mis compras" dura 30 días en ese navegador. Habrá botones "Cerrar sesión" y "Cerrar sesión en todos los dispositivos". Los correos y el tiquete dirán "Este enlace es personal". |
| FR-121 | Mientras no haya productos digitales publicados, la sección Digital de la tienda, "Mis compras" digital y los bloques de sugeridos (FR-106) no se muestran. Crear el primero desde el admin los activa sin cambios de código. |

### 6.10 Reembolsos y cambios de correo

El panel de Wompi se usa para la plata; el admin de VolleyTip, para la operación.

| ID | Requisito |
| --- | --- |
| FR-109 | El admin podrá cambiar el correo de un pedido: lo busca por referencia (VT-XXXX), nombre o fecha y valor; debe anotar cómo verificó al comprador (comprobante de pago con la referencia). Al guardar: las compras digitales y los tiquetes pasan al correo nuevo, se invalidan los enlaces y sesiones del correo anterior, se reenvían "Tu compra digital" y los tiquetes al correo nuevo y queda registro de quién, cuándo y el motivo. |
| FR-113 | El admin tendrá el botón "Reembolsar" en el pedido, por pedido completo o por ítem, con motivo obligatorio. Antes de confirmar muestra la fecha de compra y, para productos digitales, el avance del comprador (% visto y descargas). Al confirmar: revoca el acceso digital, anula el tiquete y libera el cupo, devuelve el inventario si el producto físico regresó, envía el correo "Reembolso confirmado" y genera la nota crédito si hubo factura electrónica (FR-031–FR-034). |
| FR-114 | La devolución del dinero depende del medio de pago (por confirmar con Wompi): tarjeta, anulación o reverso en Wompi; PSE, Nequi y Botón Bancolombia, transferencia hecha por VolleyTip. En fase 1 el dinero se devuelve a mano (panel de Wompi o transferencia) y el admin registra la referencia o el comprobante; en fase 2 el botón podrá pedir la anulación con tarjeta por la API de Wompi si está disponible. |
| FR-115 | Cada pedido guarda el id de la transacción de Wompi, el medio de pago y la referencia VT-XXXX, y el admin muestra un enlace a esa transacción en el panel de Wompi. El panel de Wompi se usa para la plata (pagos, comisiones, desembolsos, anulaciones); el admin de VolleyTip para la operación (envíos, accesos, tiquetes, reembolsos). |

### 6.11 Nosotros, contacto, app y páginas de apoyo

| ID | Requisito |
| --- | --- |
| FR-052 | Nosotros mostrará héroe con foto y cifras, "Cómo lo hacemos", la historia desde 2019 en cuatro momentos, los fundadores (Andrés Piza y Camilo Gómez), los personajes y "Trabajemos juntos". |
| FR-053 | Contacto tendrá un formulario por motivo (pedido, camps, marcas, sugerir un tip, otro) cuyos campos cambian según el motivo, promesa de respuesta en 24 horas, WhatsApp y team@volleytip.com, con anti-spam y límite por IP. |
| FR-054 | La página de la app mostrará la app gratuita y sus funciones, con estado lista de espera o disponible (botones oficiales de las tiendas). |
| FR-055 | (Aplica cuando exista la app; en la fase 1 la ruta se comporta como indica FR-080.) `volleytip.com/r/<código>` abrirá la rutina en la app si está instalada y, si no, mostrará la rutina con sus ejercicios desplegables (video, series, repeticiones o tiempo, descanso, nota) y el botón "Abrir en la app". |
| FR-056 | El sistema mostrará páginas de error 404, 500, mantenimiento (activable sin desplegar) y pago rechazado. |
| FR-057 | El sistema publicará Términos, Privacidad y tratamiento de datos, Cambios y devoluciones, y Envíos, en ambos idiomas, y registrará la versión aceptada en cada consentimiento. |
| FR-137 | El sistema tendrá una página general de preguntas frecuentes, en ambos idiomas, con preguntas y respuestas editables desde el admin (FR-065); el pie enlaza a ella (FR-003). |

### 6.12 Admin

| ID | Requisito |
| --- | --- |
| FR-058 | El admin en `/admin` permitirá entrar con enlace mágico o Google solo a correos autorizados, con roles admin y staff de check-in. |
| FR-059 | Resumen: ventas del mes, pedidos por enviar, inscritos del próximo camp, mensajes sin responder, stock bajo y última actividad. |
| FR-060 | Tips: lista y editor con subida a Bunny Stream con progreso, campos del tip, promo, programación, destacado y pestañas por idioma. |
| FR-061 | Productos: editor por idioma con colores y fotos (ordenar, portada), tallas, stock color × talla con alertas, precio base y por mercado, relacionados, umbral y lista de espera de reposición. |
| FR-062 | Pedidos: filtros, CSV, detalle con ítems por tipo, pago Wompi (FR-115), factura (cuando el módulo esté activo) e historial; marcar enviado con transportadora y guía (avisa al cliente), reenviar confirmación, cambiar el correo (FR-109) y reembolsar (FR-113). |
| FR-063 | Camps: crear y editar evento por idioma con capacidad, planes y precios, club y parte del club (FR-116), códigos de club con su plan, cupos y precio prepagado (FR-037), liquidación (FR-117), inscritos con reenvío de tiquete y exportación, enlaces de staff con PIN y acceso al escáner. |
| FR-064 | Mensajes: bandeja por motivo, respuesta con plantillas y adjuntos desde team@volleytip.com. |
| FR-065 | Textos del sitio, preguntas frecuentes (FR-137), idiomas y mercados, tasa aproximada del dólar (FR-122) y equipo editables sin código. |
| FR-066 | En celular, el admin tendrá barra inferior con Inicio, Pedidos, Subir tip, Camps y Más; despachar pedidos (con escaneo de guía), subir tips y manejar el camp serán completos; el resto, simplificado (completo en fase 2). |
| FR-067 | Toda acción del admin quedará en una bitácora de auditoría; pedidos, inscripciones y facturas se anulan, nunca se borran. |
| FR-128 | Al encender el módulo, las facturas se emiten solo para pedidos nuevos; el admin podrá emitir a mano la de un pedido anterior. El admin exportará las ventas en CSV (fecha, referencia, cliente, documento, ítems, base, IVA, total, medio de pago, reembolsos) para el contador, desde la fase 1. |
| FR-129 | El resumen del admin mostrará el total cobrado por Wompi en el año calendario (ventas menos reembolsos, incluida la parte de los clubes) frente a un tope anual editable en Ajustes, con un aviso al llegar al 70% y al 90%. Sirve para saber a tiempo cuándo hablar con el contador. |

### 6.13 Correos automáticos

| ID | Requisito |
| --- | --- |
| FR-068 | El sistema enviará con Resend desde team@volleytip.com, en el idioma del destinatario: pedido confirmado (un solo correo con cada parte de la compra), tu compra digital (FR-105), tu tiquete, pago en proceso, pedido enviado, código de acceso a "Mis compras", recordatorio del camp (día anterior, 6 p. m.), reenvío de tiquetes, código para ceder un cupo (FR-119), cupo cedido (al que cede y al nuevo jugador), reembolso confirmado, correo de la compra actualizado, recordatorio de carrito (FR-102), volvió el stock (una sola vez), aviso de nuevo camp, fotos del camp (fase 2), confirmación y recordatorio de asistencia al VBall Tour (solo a quien dejó correo, FR-131), respuesta a contacto y acceso al admin. |
| FR-069 | Cada envío quedará registrado con estado; los fallos se reintentan y se ven en el admin. Los correos de marketing llevan enlace para darse de baja. |

### 6.14 Galerías (fase 2)

| ID | Requisito |
| --- | --- |
| FR-050 | Cada evento pasado podrá tener una galería con fotos y videos en Bunny Storage, filtros Todo / Fotos / Videos y por día, descarga individual y un ZIP generado una sola vez. |
| FR-051 | Al publicar se podrá avisar por correo a los inscritos; las galerías no se indexan en buscadores. |

### 6.15 Factura electrónica (a futuro, con el camino preparado)

**Situación al 11 de noviembre de 2026.** VolleyTip es una marca registrada, no una empresa, y la cuenta de Wompi está a nombre de una persona natural. Aplican los topes de persona natural (valores de 2026, por confirmar con un contador): no es responsable de IVA mientras sus ingresos gravados del año anterior no pasen de $174.297.000 y sus consignaciones del año no pasen de $183.309.000; debe declarar renta si sus ingresos o consignaciones del año superan $69.719.000. Los topes cuentan todo lo que recibe esa persona, no solo VolleyTip, e incluyen la parte del club que entra por Wompi. Por eso el admin vigila el acumulado del año (FR-129).

Mientras esté por debajo, FR-031 a FR-034 **no se construyen**: el cliente recibe el comprobante de Wompi y el correo de confirmación, que no son factura. Lo que sí se construye en la fase 1 para no rehacer nada después es FR-125 y FR-126 (datos y valores guardados en cada pedido, sección 6.6), FR-127 (el interruptor y la interfaz del módulo) y FR-128 (reporte de ventas, sección 6.12).

| ID | Requisito |
| --- | --- |
| FR-031 | Con cada pago aprobado (tienda o camp) el sistema creará la factura en un proveedor autorizado por la DIAN vía API y guardará número, CUFE, estado y PDF. |
| FR-032 | La factura se adjuntará o enlazará en el correo de confirmación. |
| FR-033 | Si el proveedor falla, el pedido sigue: la factura queda pendiente, se reintenta y el admin muestra una alerta con opción de reintentar. |
| FR-034 | Anulaciones y reembolsos generarán nota crédito. |
| FR-127 | La facturación será un módulo aparte detrás de un interruptor en el admin (apagado en la fase 1), con una sola interfaz interna (emitir factura, emitir nota crédito, consultar estado) para conectar cualquier proveedor (Alegra, Siigo u otro) sin tocar el checkout. El pedido tiene desde ya los campos de estado de factura, número, CUFE y enlace al PDF, vacíos. |

### 6.16 Reemplazo de la web actual

| ID | Requisito |
| --- | --- |
| FR-070 | El sistema tendrá un entorno de pruebas (por ejemplo `staging.volleytip.com`) con su propio proyecto de Supabase y llaves de prueba de Wompi, donde se valida cada epic antes de producción. |
| FR-071 | Antes del cambio, se descargarán de Strapi y de DigitalOcean las fotos de productos que sirvan y se subirán a Bunny Storage; no se migran pedidos, clientes ni tablas. |
| FR-072 | El cambio a la nueva web se hará apuntando los DNS de volleytip.com en Namecheap a Railway, con una lista de verificación (certificado HTTPS, correo de Resend verificado, webhooks de Wompi y Bunny apuntando a producción, compra real de prueba y reembolso). |
| FR-073 | Cualquier dirección de la web anterior que ya no exista mostrará la página 404 con buscador; no se configuran redirecciones una a una. |
| FR-074 | Durante el cambio se podrá activar la página de mantenimiento (FR-056) sin desplegar. |
| FR-075 | Los servidores de DigitalOcean y Strapi se apagarán 30 días después del cambio, guardando antes una copia de su base de datos y archivos, y los repos `frontend-volleytip` y `backend-volleytip` se archivarán. |

### 6.17 Preparación para la app móvil

| ID | Requisito |
| --- | --- |
| FR-076 | El proyecto de Supabase de la web será el mismo que usará la app; el esquema separa las tablas de la web (tienda, camps, admin) de las que compartirán ambas (tips, idiomas, perfiles, medios). |
| FR-077 | Las cuentas usarán Supabase Auth con una tabla de perfiles con rol: admin, staff de check-in y comprador. El perfil de comprador se crea solo, sin contraseña, cuando alguien paga o entra a "Mis compras" con su correo (FR-110). La app podrá reutilizar ese mismo perfil sin cambios de esquema. |
| FR-078 | El contenido bilingüe (tablas `*_translations`) y los videos en Bunny Stream seguirán un formato que la app pueda leer tal cual; los tips se exponen por una vista o función de solo lectura apta para consumirse desde la app. |
| FR-079 | El admin se construirá por módulos de contenido, de forma que después se puedan agregar ejercicios, programas y reglas del generador de la app sin rediseñarlo. |
| FR-080 | La ruta `volleytip.com/r/<código>` quedará reservada; mientras no exista la app, muestra una página "Próximamente" con la lista de espera de la app. |
| FR-081 | La web servirá los archivos de asociación de enlaces de app (`/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`), configurables sin desplegar cuando la app tenga sus identificadores. |
| FR-082 | La lista de espera de la app (FR-054) guardará correo, idioma y país, para avisar el lanzamiento. |

### 6.18 Imágenes, rendimiento y hosting

| ID | Requisito |
| --- | --- |
| FR-123 | Imágenes: se sube una sola versión en alta resolución y Bunny Optimizer entrega el tamaño y formato (WebP o AVIF) adecuados a cada pantalla, incluidas las de alta densidad. Las imágenes fuera de pantalla cargan de forma diferida, todas reservan su espacio para que la página no salte y los videos muestran una portada hasta reproducirse. |
| FR-124 | Hosting de arranque: Railway plan Hobby. Se evalúa pasar a Vercel si la web se pone lenta en lanzamientos o el costo de Railway se acerca a US$20 al mes; el código no debe depender de nada exclusivo de Railway. Fase 1 sin herramienta de analítica; el admin muestra ventas, pedidos e inscritos. |

### 6.19 VBall Tour

El VBall Tour es un evento social y recreativo: VolleyTip reúne fundaciones y empresas y lleva actividades, premios y recursos a comunidades que lo necesitan. No es un entrenamiento ni se cobra entrada, así que no usa el carrito ni los tiquetes del Camp. Mockup: "VBall Tour".

| ID | Requisito |
| --- | --- |
| FR-130 | El VBall Tour tendrá su propia página y entrada en el menú: qué es (un evento social y recreativo, distinto del Camp), próxima parada (fecha, lugar y aliados), qué pasa en una parada, fotos, aliados y los dos formularios (FR-131 y FR-132). Las paradas se crean en el admin como eventos de tipo "tour": gratuitos, sin planes, sin carrito y sin tiquetes. |
| FR-131 | Registro de asistencia gratuito ("Voy a asistir"), individual o de grupo (FR-136): parada, nombre, WhatsApp, correo opcional y número de asistentes (adultos, y niños y jóvenes). No se piden nombres ni datos de menores. No crea tiquete ni pasa por el checkout. Al enviar, la pantalla muestra la confirmación con un enlace para cambiar el número o cancelar. Si la persona dejó correo, recibe además la confirmación con ese enlace y un recordatorio el día anterior; la web no envía mensajes de WhatsApp. El texto del mockup "Te recordamos el día antes por WhatsApp o correo" hay que cambiarlo (pendiente P-24). Anotarse no es obligatorio para asistir: sirve para planear el evento. |
| FR-132 | Formulario de aliados para empresas y fundaciones: organización, tipo, nombre de contacto, correo, WhatsApp, ciudad o región de interés, forma de participar (donar en especie, patrocinar una parada, voluntarios o actividad, llevar el Tour a su región; se pueden marcar varias) y mensaje. Llega a la bandeja de mensajes del admin con el motivo "VBall Tour" (FR-064). |
| FR-133 | La web no recibe donaciones en dinero. La página explica que las donaciones en dinero las reciben directamente las fundaciones aliadas, cuyos nombres y enlaces se editan en el admin. Los patrocinios pagados a VolleyTip se acuerdan por fuera de la web. |
| FR-134 | Admin del Tour: crear y editar paradas (por idioma, con fecha, lugar, aliados, fotos y cupo estimado opcional), ver el total de asistentes esperados por parada (adultos y niños), exportar la lista de registros y ver los aliados interesados. La página pública muestra el contador "N personas ya dijeron que van" si el admin lo activa. |

### 6.20 Protección de formularios

Aplica a todos los formularios que cualquiera puede enviar sin haber pagado ni iniciado sesión.

| ID | Requisito |
| --- | --- |
| FR-135 | Todo formulario público (contacto, aliados, asistencia al VBall Tour, "Avísame", lista de espera de la app y petición del código de "Mis compras") tendrá cinco capas contra bots: (1) Cloudflare Turnstile verificado en el servidor: sin esa verificación el envío no se guarda; (2) un campo trampa invisible: si llega lleno, el envío se descarta sin avisar; (3) tiempo mínimo: se descarta lo enviado en menos de 3 segundos desde que cargó el formulario; (4) límite de 5 envíos cada 10 minutos por IP en cada formulario (el registro de asistencia al VBall Tour tiene su propia regla, FR-136); (5) validación en el servidor de formato y longitud de cada campo. Los envíos descartados se cuentan en el admin, sin guardar su contenido. |
| FR-136 | Reglas propias del registro de asistencia al VBall Tour, pensadas para no perder registros reales: (1) un solo registro por número de WhatsApp en cada parada; si se repite, actualiza el anterior. (2) Registro individual o familiar: máximo 10 personas. (3) Registro de grupo (colegio, club, fundación): pide institución, responsable y número de personas, sin ese tope. (4) El límite por IP es de 30 envíos cada 10 minutos, y lo que lo supere no se descarta: se guarda como "por revisar". (5) También quedan "por revisar" los grupos de más de 50 personas. Un registro por revisar recibe su confirmación normal, no suma al contador público y el admin lo aprueba o lo borra con un clic. (6) El admin recibe una alerta si una parada pasa de 30 registros en una hora; la alerta solo avisa, no bloquea. (7) El admin puede borrar registros falsos y el contador se recalcula. |

## 7. Historias de usuario

| ID | Historia | FRs |
| --- | --- | --- |
| US-01 | Como seguidor que llega desde TikTok, quiero ver un tip y los relacionados, para seguir aprendiendo. | FR-013–FR-016 |
| US-02 | Como comprador en el celular, quiero comprar una camiseta con Nequi sin crear cuenta, para hacerlo en dos minutos. | FR-020, FR-022–FR-028 |
| US-03 | Como padre, quiero inscribir a mis dos hijos al camp y recibir sus tiquetes, para que entren sin problema. | FR-038–FR-041, FR-043 |
| US-04 | Como jugador de un club que prepagó, quiero inscribirme con el código sin pagar. | FR-037, FR-039, FR-097 |
| US-05 | Como voluntario del club, quiero escanear tiquetes con mi celular sin crear cuenta. | FR-046–FR-049 |
| US-06 | Como Andrés, quiero subir un tip desde el celular en la cancha. | FR-060, FR-066 |
| US-07 | Como Andrés, quiero marcar un pedido enviado con la guía y que el cliente se entere solo. | FR-062, FR-068 |
| US-08 | Como visitante de Ecuador, quiero ver la web en inglés o español y saber qué puedo comprar desde mi país. | FR-004–FR-009, FR-093, FR-122 |
| US-09 | Como jugador que vio un tip de recepción, quiero comprar el paquete completo de recepción y verlo enseguida desde el celular, sin crear cuenta. | FR-083–FR-088, FR-106 |
| US-10 | Como padre, quiero pagar en una sola compra el cupo del camp de mi hija, su camiseta y un paquete digital, para no hacer tres pagos. | FR-095–FR-100 |
| US-11 | Como comprador que escribió mal su correo, quiero que me lo corrijan mostrando mi comprobante, para no perder lo que pagué. | FR-107–FR-109 |
| US-12 | Como jugador que ya no puede ir al camp, quiero pasarle mi cupo a un compañero, para no perder la plata. | FR-118, FR-119 |
| US-13 | Como Andrés, quiero saber cuánto le debo a cada club después de un camp y dejar registrado el pago. | FR-116, FR-117 |
| US-14 | Como empresa o fundación, quiero decirle a VolleyTip cómo puedo sumarme al VBall Tour, para que me contacten. | FR-130, FR-132, FR-133 |
| US-15 | Como Andrés, quiero saber cuántas personas piensan ir a cada parada del VBall Tour, para planear premios y logística. | FR-131, FR-134 |

## 8. Criterios de aceptación

### Idiomas y mercados

- **AC-001** *(FR-004, FR-005)* — Dado un navegador en inglés, Cuando entra por primera vez a volleytip.com, Entonces se le propone `/en/`; Cuando elige Español, Entonces las siguientes visitas abren en español.
- **AC-002** *(FR-006)* — Dado el build de producción, Cuando corre la prueba de textos, Entonces falla si hay texto visible sin clave de traducción o una clave sin traducción en inglés.
- **AC-003** *(FR-007)* — Dado un producto sin descripción en inglés, Cuando se ve en `/en/`, Entonces aparece la descripción en español.
- **AC-004** *(FR-010, FR-011)* — Dado un pedido pagado a $120.000, Cuando el admin sube el precio a $130.000, Entonces el pedido sigue mostrando $120.000.

### Tienda, carrito y pagos

- **AC-005** *(FR-020, FR-023)* — Dada Negro M con stock 1 en dos carritos, Cuando ambos pagan, Entonces solo el primer pago aprobado descuenta stock; al segundo se le avisa antes de cobrar o, si ya pagó, el pedido queda para reembolso y alerta en el admin.
- **AC-006** *(FR-022, FR-120)* — Dado un subtotal de $150.000 en productos físicos, Entonces el carrito dice "Te faltan $50.000 para el envío gratis"; Dado $200.000 en productos físicos, Entonces el envío es $0. Los productos digitales y los cupos no suman para el envío gratis.
- **AC-007** *(FR-025–FR-027)* — Dado un pago Nequi aprobado, Cuando llega el evento de Wompi con firma válida, Entonces el pedido pasa a pagado, se descuenta stock y sale el correo; Cuando el mismo evento llega dos veces, Entonces no se duplica nada.
- **AC-008** *(FR-026)* — Dado un evento con firma inválida, Entonces se rechaza y el pedido no cambia.
- **AC-009** *(FR-029, FR-099)* — Dado un pedido pendiente sin pago iniciado por 31 minutos, Entonces pasa a expirado y se liberan su stock y sus cupos; Dado un pedido cuya transacción Wompi reporta como pendiente, Cuando pasan 31 minutos, Entonces no expira y conserva stock y cupos hasta que Wompi la apruebe o la rechace.
- **AC-041** *(FR-095, FR-098, FR-100)* — Dado un carrito con una camiseta, un paquete digital y un cupo de camp, Cuando se paga, Entonces hay un solo cobro, el pedido queda por enviar, el paquete queda disponible y se emite el tiquete del jugador.
- **AC-042** *(FR-098)* — Dado un carrito solo con productos digitales, Entonces el checkout no pide dirección ni datos de jugador.
- **AC-043** *(FR-037, FR-097)* — Dado un carrito con un cupo y un código de club válido para ese plan, Entonces el cupo queda en $0 y el resto del carrito se cobra normal; Dado un código de club de otro plan, Entonces se rechaza y el cupo conserva su precio; Dado que el carrito queda en $0, Entonces se confirma sin pasar por Wompi.
- **AC-044** *(FR-099)* — Dado un carrito con un cupo que se agotó mientras la persona llenaba el checkout, Cuando pulsa Pagar, Entonces se le avisa, se quita el cupo y puede pagar el resto.
- **AC-045** *(FR-093)* — Dado un comprador en Perú, Cuando compra solo un paquete digital, Entonces puede pagar con tarjeta y no se le piden datos de envío.
- **AC-046** *(FR-107)* — Dado un carrito con un paquete digital, Cuando se pulsa Pagar, Entonces aparece "¿Este es tu correo?" con el correo escrito y no se va a Wompi hasta pulsar "Sí, es correcto · Ir a pagar"; Dado un carrito solo con camisetas, Entonces no aparece la ventana.
- **AC-047** *(FR-108)* — Dado que se escribe juan@gmial.com, Entonces aparece "¿Quisiste decir juan@gmail.com?" y al tocarlo el campo queda corregido.
- **AC-057** *(FR-120)* — Dado un carrito de $150.000 en productos físicos para la zona "Resto del país", Entonces se cobra la tarifa de esa zona; Dado un carrito de $210.000, Entonces el envío es $0; Cuando el admin guarda transportadora y guía, Entonces sale el correo de envío.
- **AC-059** *(FR-125–FR-128)* — Dado el módulo de factura apagado, Cuando se paga un pedido, Entonces no se llama a ningún proveedor, el pedido guarda base, IVA y total por ítem y los campos de factura quedan vacíos; Cuando el admin exporta las ventas del mes, Entonces el CSV trae esos valores por pedido.

### Camps, tiquete y check-in

- **AC-011** *(FR-040)* — Dado un camp con 1 cupo libre y dos personas pagando a la vez, Entonces solo una obtiene el cupo y la otra ve "Agotado" antes de pagar.
- **AC-012** *(FR-040)* — Dada una reserva sin pago iniciado por 31 minutos, Entonces el cupo vuelve a estar disponible.
- **AC-013** *(FR-039)* — Dado un código de club con 120 cupos comprados y 120 usados, Cuando alguien lo usa, Entonces se rechaza con "Los cupos de tu club se agotaron".
- **AC-014** *(FR-042)* — Dado un código de club con 40 cupos prepagados y 25 usados, Entonces el admin muestra 15 disponibles y esos cupos no suman a la liquidación del club.
- **AC-015** *(FR-048)* — Dado un tiquete válido el día 1, Cuando se escanea, Entonces sale válido; Cuando se escanea otra vez el día 1, Entonces sale "Ya ingresó" con hora y staff; Cuando se escanea el día 2, Entonces sale válido.
- **AC-016** *(FR-046, FR-047)* — Dado un enlace de staff, Cuando se ingresan 5 PIN incorrectos, Entonces se bloquea 15 minutos; Dado un enlace desactivado o fuera de fechas, Entonces no abre el escáner.
- **AC-017** *(FR-049)* — Dado el escáner sin conexión, Cuando se escanea un tiquete de la lista, Entonces se marca válido localmente y se sincroniza al volver la señal; la lista descargada contiene hashes de los tokens y ningún token.
- **AC-066** *(FR-048, FR-049)* — Dados dos jugadores con el mismo nombre, Cuando el staff busca ese nombre, Entonces cada resultado muestra el nombre del comprador y los últimos 4 dígitos de su WhatsApp, y ninguno muestra si el jugador es menor ni los datos del acudiente.
- **AC-018** *(FR-045)* — Dado un correo sin inscripciones, Cuando se pide reenvío, Entonces la pantalla dice lo mismo que con un correo con inscripciones.
- **AC-054** *(FR-116, FR-117)* — Dado un camp con parte del club de $20.000, 87 cupos pagados y 2 reembolsados, Entonces la liquidación muestra 85 × $20.000 = $1.700.000; Cuando el admin la marca como pagada con comprobante, Entonces queda cerrada con fecha.
- **AC-055** *(FR-118)* — Dado un camp que empieza en 10 días, Cuando el admin reembolsa un cupo, Entonces el sistema lo permite sin aviso; Dado un camp que empieza en 5 días, Entonces avisa que está fuera del plazo de la política y pide confirmar.
- **AC-056** *(FR-119)* — Dado un tiquete válido 3 días antes del camp, Cuando alguien abre "Ceder mi cupo" solo con el enlace del tiquete, Entonces se le pide el código enviado al correo del comprador; Cuando el comprador cede el cupo con ese código o con sesión en "Mis compras", Entonces el QR anterior marca "no válido" en el check-in, el nuevo jugador recibe su tiquete y la lista de inscritos muestra el nombre nuevo.

### Productos digitales y "Mis compras"

- **AC-036** *(FR-084)* — Dado un paquete con 2 lecciones de muestra, Cuando un visitante sin compra abre la página, Entonces puede ver esas 2 lecciones y las demás aparecen con candado.
- **AC-037** *(FR-085, FR-086, FR-105)* — Dado un pago aprobado de un paquete, Entonces en menos de 1 minuto llega el correo con el enlace; Cuando la persona lo abre por primera vez dentro de las 24 horas, Entonces entra a "Mis compras" sin código, ve el paquete y puede reproducir la primera lección; Cuando lo abre por segunda vez o después de 24 horas, Entonces ve la pantalla de entrada con su correo ya escrito.
- **AC-038** *(FR-088)* — Dado un enlace de video firmado, Cuando se usa después de vencer o desde otro dominio, Entonces Bunny lo rechaza; Dado un enlace de descarga, Cuando pasan 15 minutos, Entonces deja de funcionar.
- **AC-039** *(FR-089)* — Dado un PDF de un paquete, Cuando el comprador lo descarga, Entonces cada página lleva su correo como marca.
- **AC-040** *(FR-092)* — Dado un reembolso, Cuando el admin revoca el acceso, Entonces el comprador deja de ver el paquete en "Mis compras" y los enlaces vigentes vencen sin renovarse.
- **AC-049** *(FR-110)* — Dado un correo que nunca ha comprado y otro que sí, Cuando se piden códigos para ambos, Entonces la pantalla muestra exactamente el mismo mensaje.
- **AC-050** *(FR-111)* — Dado que alguien falla 5 veces el código de un correo, Entonces ese código deja de servir y el dueño puede pedir uno nuevo y entrar enseguida; Dado que se piden 6 códigos en una hora, Entonces el sexto no se envía y el enlace del correo anterior sigue funcionando.
- **AC-051** *(FR-112)* — Dado un comprador con sesión en el celular y el computador, Cuando pulsa "Cerrar sesión en todos los dispositivos", Entonces ambos piden código de nuevo.
- **AC-058** *(FR-121)* — Dado que no hay productos digitales publicados, Entonces la tienda no muestra la sección Digital ni bloques vacíos; Cuando se publica el primero, Entonces aparecen.

### Reembolsos y cambios de correo

- **AC-048** *(FR-109)* — Dado un pedido con un correo mal escrito, Cuando el admin lo cambia anotando la verificación, Entonces el comprador ve el paquete al entrar con el correo nuevo, el enlace de "Tu compra digital" enviado al correo anterior deja de funcionar aunque no se haya usado ni vencido, las sesiones del correo anterior se cierran y el cambio queda registrado.
- **AC-052** *(FR-113)* — Dado un pedido con un paquete digital y un cupo de camp, Cuando el admin reembolsa ambos ítems, Entonces el paquete desaparece de "Mis compras", el tiquete queda anulado, el cupo vuelve a estar disponible y llega el correo "Reembolso confirmado".
- **AC-053** *(FR-114, FR-115)* — Dado un reembolso de un pago por Nequi, Entonces el admin pide el comprobante de la transferencia y no lo marca como devuelto sin él; Dado cualquier pedido, Entonces el admin muestra el enlace a su transacción en Wompi.

### Admin

- **AC-019** *(FR-058)* — Dado un correo no autorizado, Cuando pide enlace de acceso, Entonces no puede entrar al admin.
- **AC-020** *(FR-062, FR-068)* — Dado un pedido pagado, Cuando el admin lo marca enviado con transportadora y guía, Entonces el cliente recibe el correo con la guía en su idioma.

### Navegación, home y tips

- **AC-021** *(FR-001, FR-065)* — Dado un admin que cambia el texto de la barra de anuncios, Cuando guarda, Entonces el nuevo texto aparece en todas las páginas en menos de 1 minuto, en el idioma correspondiente.
- **AC-022** *(FR-002)* — Dada una pantalla de 360 px, Cuando se abre el menú, Entonces ocupa toda la pantalla, cada opción mide al menos 48 px de alto y se cierra con el botón o con la tecla Escape.
- **AC-023** *(FR-012)* — Dado que no hay camps próximos, Entonces la home muestra la invitación "Avísame" en lugar del bloque de eventos.
- **AC-024** *(FR-013)* — Dados los filtros Recepción + Básico, Entonces la URL los refleja, solo aparecen tips que cumplen ambos y al recargar la página se conservan.
- **AC-025** *(FR-014, FR-016)* — Dado un tip vertical en celular, Cuando el usuario toca Siguiente, Entonces abre el siguiente tip del mismo fundamento; Dado el último tip del fundamento, Entonces Siguiente queda deshabilitado.
- **AC-026** *(FR-017)* — Dada la lista de videos de la librería de Bunny, Cuando el admin importa uno, Entonces se crea un tip en borrador con el video, la duración y la miniatura ya cargados.

### Páginas de apoyo y galerías

- **AC-027** *(FR-053)* — Dado el motivo "Un pedido", Entonces el formulario pide número de pedido; Cuando se envían más de 5 mensajes en 10 minutos desde la misma IP, Entonces se rechazan los siguientes.
- **AC-028** *(FR-056)* — Dada una dirección inexistente, Entonces responde 404 con buscador de tips; Dado el modo mantenimiento activo, Entonces toda página pública muestra la página de mantenimiento y el admin sigue accesible.
- **AC-065** *(FR-137)* — Dado un admin que publica una pregunta frecuente solo en español, Entonces aparece en la página de preguntas frecuentes y en `/en/` se muestra en español hasta que tenga traducción.
- **AC-029** *(FR-050, FR-051)* — Dada una galería publicada, Cuando se pide el ZIP, Entonces se descarga el archivo ya generado sin volver a armarlo; la página incluye `noindex`.

### Reemplazo de la web actual

- **AC-030** *(FR-070)* — Dado un pago en el entorno de pruebas, Entonces usa las llaves de prueba de Wompi y no genera cobros ni facturas reales.
- **AC-031** *(FR-072)* — Dado el día del cambio, Cuando se completa la lista de verificación, Entonces volleytip.com sirve la nueva web por HTTPS, una compra real de prueba llega a pagado y se reembolsa.
- **AC-032** *(FR-073)* — Dada una dirección de la web anterior que no existe, Entonces se muestra la 404 de la nueva web.

### Preparación para la app

- **AC-033** *(FR-077)* — Dada la tabla de perfiles, Entonces admite el rol de comprador (el que usará la app) sin migración nueva y las políticas RLS del admin no le dan acceso.
- **AC-034** *(FR-078)* — Dado un cliente con la llave pública de Supabase y sin sesión, Cuando consulta la vista de tips, Entonces recibe solo tips publicados con sus traducciones y el ID de video de Bunny.
- **AC-035** *(FR-080, FR-081)* — Dado `volleytip.com/r/abc123`, Entonces se muestra "Próximamente" con la lista de espera; Dado `/.well-known/assetlinks.json`, Entonces responde JSON válido (vacío mientras no haya app).

### VBall Tour y protección de formularios

- **AC-060** *(FR-131, FR-134)* — Dado un registro al VBall Tour con 2 adultos y 3 niños, Entonces el total esperado de esa parada sube en 5, no se crea pedido ni tiquete y la pantalla muestra la confirmación con el enlace de gestión (que también llega por correo si la persona lo dejó); Cuando la persona cambia el número a 3 con el enlace, Entonces el total se ajusta.
- **AC-061** *(FR-132)* — Dado el formulario de aliados enviado por una empresa, Entonces aparece en la bandeja del admin con el motivo "VBall Tour" y las formas de participar marcadas.
- **AC-062** *(FR-133)* — Dada la página del VBall Tour, Entonces no hay ningún botón de pago ni de donación en línea y se muestran las fundaciones que reciben donaciones.
- **AC-063** *(FR-135)* — Dado un envío del formulario de contacto sin verificación válida de Turnstile, con el campo trampa lleno o hecho en menos de 3 segundos, Entonces no se guarda ni se envía ningún correo; Dado el sexto envío en 10 minutos desde la misma IP, Entonces se rechaza.
- **AC-064** *(FR-136)* — Dado un WhatsApp ya registrado en una parada con 4 personas, Cuando se registra otra vez con 6, Entonces queda un solo registro con 6; Dado un registro individual con 25 personas, Entonces se le pide usar el registro de grupo; Dado un colegio que registra un grupo de 180 personas, Entonces el responsable ve la confirmación, el registro queda por revisar y el contador público sube en 180 solo cuando el admin lo aprueba; Dado el envío número 31 en 10 minutos desde la misma IP, Entonces se guarda por revisar en vez de rechazarse.

### Factura electrónica (a futuro)

- **AC-010** *(FR-033, solo con el módulo de factura encendido)* — Dado que el proveedor de factura no responde, Entonces el pedido queda pagado, la factura pendiente y el admin muestra la alerta con "Reintentar".

## 9. Requisitos de datos

Postgres en Supabase con RLS en todas las tablas; contenido base + tablas `*_translations` por idioma.

| Grupo | Entidades |
| --- | --- |
| Configuración | Idiomas, mercados, zonas de envío, textos del sitio, ajustes (umbral de envío gratis, tope anual, tasa aproximada del dólar, interruptor de factura) |
| Contenido | Tips, medios |
| Tienda física | Productos, colores, imágenes, variantes (color × talla con stock), precios por mercado, relacionados, alertas de reposición |
| Productos digitales | Productos digitales, secciones, lecciones, archivos, combos, accesos (correo dueño, origen, estado), avance por lección |
| Compra | Carritos con correo (para el recordatorio), pedidos con estado de pago y estado de entrega, líneas de pedido con tipo (físico, digital, cupo) y con base, IVA y total, eventos de pago, reembolsos, facturas (vacías en la fase 1) |
| VBall Tour | Paradas (eventos de tipo tour), registros de asistencia (contacto y número de adultos y niños), aliados interesados |
| Camps | Eventos (con tipo, capacidad, club y parte del club), planes, códigos de club (con plan, cupos y precio prepagado), inscripciones (jugador y acudiente), tiquetes, cesiones de cupo, ingresos por día, enlaces de staff, liquidaciones |
| Otros | Galerías (fase 2), mensajes, preguntas frecuentes, listas de espera, perfiles (admin, staff, comprador), bitácora de auditoría, registro de correos |

- DR-001: montos como enteros en la unidad menor de la moneda con su código ISO 4217.
- DR-002: stock y cupos descontados en transacción con bloqueo de fila; nunca negativos.
- DR-003: números de pedido consecutivos (VT-1001…); identificadores internos UUID.
- DR-004: tokens de tiquete y de enlaces privados aleatorios e impredecibles.
- DR-005: eventos de webhook guardados con identificador único para idempotencia.
- DR-006: pedidos, inscripciones, accesos y facturas no se borran; se anulan con estado.
- DR-007: datos de menores anonimizados \[N\] meses después del evento (pendiente P-11).
- DR-008: el correo se guarda normalizado (minúsculas, sin espacios) y es la clave que une pedidos, accesos digitales y tiquetes de un comprador.
- DR-009: cada línea de pedido guarda precio, base, IVA, moneda y nombre del ítem tal como eran al comprar.

## 10. Integraciones

| ID | Integración | Uso | Fase |
| --- | --- | --- | --- |
| INT-001 | Supabase (Postgres, Auth, Edge Functions, Cron) | Datos, login del equipo y de compradores (código por correo), webhooks, tareas programadas; proyectos de pruebas (plan gratis) y producción (plan Pro) separados | 1 |
| INT-002 | Wompi | Widget de pago, firma de integridad, eventos de transacción verificados. Pagos a terceros (opcional) para transferir a clubes | 1 |
| INT-003 | Bunny Stream | Videos de tips (ya alojados, en una librería pública) y de lecciones (en una librería aparte, con URLs firmadas); subida directa desde el admin | 1 |
| INT-004 | Bunny Storage + CDN + Optimizer | Fotos de productos, archivos descargables privados, imágenes optimizadas por pantalla; galerías y ZIP en la fase 2 | 1 |
| INT-005 | Resend | Correos transaccionales y códigos de acceso, con dominio verificado (SPF, DKIM, DMARC en Namecheap). Plan gratis al arrancar y plan de pago desde los camps (BR-011) | 1 |
| INT-006 | Railway | Hosting de la app React Router 8 con despliegue desde GitHub (producción y pruebas) | 1 |
| INT-007 | Namecheap | DNS de volleytip.com | 1 |
| INT-008 | Cloudflare Turnstile | Anti-abuso en formularios públicos y en la petición de códigos | 1 |
| INT-009 | Plataforma de envíos (Envia.com o Mipaquete) | Fase 1: uso manual desde su propia web. Fase 2: cotización y guías por API | 1 manual, 2 API |
| INT-010 | Proveedor de factura electrónica (Alegra, Siigo u otro) | Emisión, CUFE, PDF y notas crédito vía API | A futuro |
| INT-011 | App VolleyTip | Rutinas compartidas y enlaces universales | A futuro |
| INT-012 | Analítica | Visitas y embudos sin datos personales | A futuro |

## 11. Requisitos no funcionales

- NFR-001 (rendimiento): LCP menor a 2,5 s en celular 4G en home, tip y producto; imágenes por tamaño de pantalla (FR-123); el video carga al tocar.
- NFR-002 (rendimiento): listados del admin en menos de 1 s con 1.000 registros.
- NFR-003 (seguridad): ninguna llave secreta en el navegador; RLS en todo; webhooks verificados por firma; límites de frecuencia y anti-abuso en formularios públicos y en los códigos de acceso (FR-111).
- NFR-004 (seguridad): los datos de tarjetas nunca pasan por VolleyTip; los datos de menores solo los ven los admins; ningún archivo de pago tiene URL pública permanente (FR-088).
- NFR-005 (privacidad): cumplimiento de la Ley 1581 de 2012 con consentimiento registrado. Sin analítica no hay aviso de cookies.
- NFR-006 (accesibilidad): WCAG 2.2 AA, teclado, foco visible, zonas de toque de 44 px.
- NFR-007 (diseño): funciona desde 360 px; tema oscuro con zonas claras; tokens de marca (#FC0035, #221761, #140A35, #CDF980, #D9E6E8), Anton y Archivo; logos oficiales de terceros. Las pantallas sin mockup de celular se construyen desde el mockup de computador y `design-system.md`.
- NFR-008 (SEO básico): títulos y descripciones por idioma, sitemap, datos estructurados (Product, Event, VideoObject); "Mis compras", tiquetes y galerías sin indexar.
- NFR-009 (disponibilidad): copias de seguridad diarias y restauración probada; monitoreo de disponibilidad.
- NFR-010 (mantenibilidad): TypeScript estricto, tipos de Supabase generados, pruebas de la lógica de pagos, stock, cupos, accesos digitales y check-in.
- NFR-011 (portabilidad): el código no depende de nada exclusivo de Railway, para poder pasar a Vercel (FR-124).

## 12. Supuestos

- ASS-001: la cuenta de Wompi, a nombre de una persona natural del equipo, está activa y habilitada para tarjeta, PSE, Nequi y Botón Bancolombia.
- ASS-002: los videos de tips ya están en Bunny Stream; solo se crean los registros de tips.
- ASS-003: no hay datos de la web actual que migrar ni tráfico que conservar.
- ASS-004: la web y la futura app comparten proyecto de Supabase (FR-076); la app actual sigue funcionando con su backend mientras se reconstruye.
- ASS-005: las ventas del primer año quedan por debajo de los topes de persona natural (sección 6.15); si no, se activa la factura electrónica.
- ASS-006: el plan Hobby de Railway permite este uso; se verifica antes del lanzamiento y, si no, se usa el plan Pro o Vercel.

## 13. Restricciones

- CON-001: React Router 8 + Tailwind 4 en Railway (React Router 7 como respaldo si la 8 no funciona con Tailwind 4); Supabase como único backend; sin servidores propios.
- CON-002: Wompi cobra solo en COP y no divide pagos entre VolleyTip y los clubes.
- CON-003: un solo desarrollador con Claude Code; epics divisibles en lotes pequeños.
- CON-004: el dominio se queda en Namecheap.
- CON-005: el equipo son dos personas; toda operación diaria (despachos, reembolsos, liquidaciones) debe poder hacerse desde el admin sin tocar código.

## 14. Riesgos

| ID | Riesgo | Mitigación |
| --- | --- | --- |
| RSK-001 | Las ventas superan los topes de persona natural sin que nadie lo note | Aviso en el admin al 70% y 90% del tope (FR-129); módulo de factura listo para encender (FR-127) |
| RSK-002 | Un webhook perdido deja pedidos pagados como pendientes | Conciliación diaria contra la API de Wompi y reintentos |
| RSK-003 | Mala conexión en el coliseo frena el check-in | Modo sin conexión (FR-049) y búsqueda por nombre |
| RSK-004 | Sobreventa de cupos o stock con compras simultáneas | Reservas de 30 minutos y transacciones con bloqueo (FR-099, DR-002) |
| RSK-005 | Textos legales y consentimientos de menores incompletos | Revisión de un abogado antes del primer camp en línea |
| RSK-006 | El comprador escribe mal el correo y no recibe su compra | Sugerencia de corrección, ventana de confirmación y cambio desde el admin (FR-107–FR-109) |
| RSK-007 | Se comparten los accesos o los archivos de un paquete digital | Acceso atado al correo, URLs firmadas, marca en los PDF, límite de sesiones (FR-088–FR-090) |
| RSK-008 | Un reembolso por PSE o Nequi no se puede reversar en Wompi | Devolución por transferencia con comprobante obligatorio (FR-114) |
| RSK-009 | Un club reclama una liquidación distinta | Liquidación calculada por el sistema, exportable y con comprobante (FR-117) |

## 15. Matriz de trazabilidad

El orden de construcción se define en el plan maestro. Como guía: W1 y W2 primero; W5, W6 y W14 forman el corazón de la venta; W13 va al final.

| Módulo (epic propuesto) | FRs | ACs | Historias | Mockups |
| --- | --- | --- | --- | --- |
| W1 · Fundación técnica y entornos | FR-070, FR-076, FR-077, FR-123, FR-124 | AC-030, AC-033 | — | — |
| W2 · Idiomas, mercados y monedas | FR-004–FR-011, FR-122 | AC-001–AC-004 | US-08 | Todas |
| W3 · Navegación, home y páginas de apoyo | FR-001–FR-003, FR-012, FR-052–FR-057, FR-080–FR-082, FR-135, FR-137 | AC-021–AC-023, AC-027, AC-028, AC-035, AC-063, AC-065| — | Home, Nosotros, Contacto, App, Errores |
| W4 · Tips | FR-013–FR-017, FR-078 | AC-024–AC-026, AC-034 | US-01 | Tips, Tip |
| W5 · Tienda física y envíos | FR-018–FR-021, FR-023, FR-120 | AC-005, AC-057 | US-02 | Tienda, Producto |
| W6 · Carrito único, checkout y Wompi | FR-022, FR-024–FR-030, FR-095–FR-102, FR-107, FR-108, FR-125, FR-126 | AC-006–AC-009, AC-041–AC-044, AC-046, AC-047, AC-059 | US-02, US-10, US-11 | Carrito único, Checkout |
| W7 · Factura electrónica (a futuro) | FR-031–FR-034 | AC-010 | — | — |
| W8 · Camps e inscripción | FR-035–FR-042, FR-116–FR-118 | AC-011–AC-014, AC-054, AC-055 | US-03, US-04, US-13 | Camps, Camp, Liquidación |
| W9 · Tiquete, ceder cupo y check-in | FR-043–FR-049, FR-119 | AC-015–AC-018, AC-056, AC-066 | US-03, US-05, US-12 | Tiquete, Mi tiquete, Ceder cupo, Check-in |
| W10 · Admin | FR-058–FR-067, FR-079, FR-109, FR-113–FR-115, FR-127–FR-129 | AC-019, AC-020, AC-048, AC-052, AC-053 | US-06, US-07, US-11 | Admin, Admin celular, Admin entrar |
| W11 · Correos | FR-068, FR-069, FR-105 | AC-020, AC-037 | US-07 | Correos |
| W12 · Galerías (fase 2) | FR-050, FR-051 | AC-029 | — | Galería |
| W13 · Lanzamiento y reemplazo | FR-071–FR-075 | AC-031, AC-032 | — | — |
| W14 · Productos digitales y "Mis compras" | FR-083–FR-094, FR-103, FR-104, FR-106, FR-110–FR-112, FR-121 | AC-036–AC-040, AC-045, AC-049–AC-051, AC-058 | US-09 | Producto digital, Lección, Mis compras |
| W15 · VBall Tour | FR-130–FR-134, FR-136 | AC-060–AC-062, AC-064 | US-14, US-15 | VBall Tour |

## 16. Pendientes

Ninguno bloquea el inicio del desarrollo. La columna "Antes de" dice cuándo debe estar resuelto.

### 16.1 Datos que se cargan en el admin (los define el equipo)

| # | Pendiente | Quién | Antes de |
| --- | --- | --- | --- |
| P-01 | Precios reales y fotos finales de los productos | Andrés | Lanzar la tienda |
| P-02 | Zonas de envío, valor por zona y tiempos estimados | Camilo y Andrés | Lanzar la tienda |
| P-03 | Elegir plataforma de envíos: Envia.com o Mipaquete (probar ambas) | Camilo y Andrés | Lanzar la tienda |
| P-04 | Días para cambio de talla y quién paga ese envío | Camilo y Andrés | Lanzar la tienda |
| P-05 | Primeros paquetes digitales: tema, lecciones, descargables y precio | Camilo y Andrés | Publicar el primer paquete |
| P-06 | Por cada camp: precio por plan, capacidad, club, parte del club y precio del cupo prepagado | Camilo y Andrés | Publicar cada camp |
| P-07 | Nombre y significado de los personajes de la marca | Andrés | Publicar "Nosotros" |
| P-08 | VBall Tour: qué fundaciones reciben las donaciones en dinero y si alguna parada tendrá cupo máximo (sección 6.19) | Camilo y Andrés | Publicar la primera parada |

### 16.2 Decisiones de política (propuesta incluida)

| # | Pendiente | Propuesta mientras se decide | Quién | Antes de |
| --- | --- | --- | --- | --- |
| P-09 | Reembolso de productos digitales | Reembolso dentro de 5 días si se ha visto menos del 20% del paquete; el admin ya muestra el avance (FR-113) | Camilo y Andrés, con abogado | Publicar el primer paquete |
| P-10 | Quién asume la comisión de Wompi en un reembolso | La asume VolleyTip si cancela VolleyTip; se descuenta si cancela el comprador | Camilo y Andrés | Lanzar |
| P-11 | Tiempo de retención de datos de menores (DR-007) | 12 meses después del camp | Abogado | Primer camp en línea |
| P-12 | Tope anual que vigila el admin (FR-129) | $69.719.000, el tope de renta de 2026 | Camilo | Lanzar |

### 16.3 Consultas externas

| # | Pendiente | Quién | Antes de |
| --- | --- | --- | --- |
| P-13 | Confirmar que por ahora no se debe facturar ni cobrar IVA, cómo manejar la parte del club que entra a la cuenta, y en qué momento conviene crear empresa o pasar al Régimen Simple | Contador | Lanzar la tienda |
| P-14 | IVA de productos digitales vendidos en Colombia y al exterior | Contador | Publicar el primer paquete |
| P-15 | Textos legales: términos, privacidad, cambios y reembolsos, deslinde y autorización de uso de imagen de menores | Abogado | Lanzar |
| P-16 | Cómo aplica el derecho de retracto a los camps (política de FR-118) y a los productos digitales | Abogado | Lanzar |
| P-17 | Wompi: cómo se anula o reversa un pago con tarjeta, si hay reverso para PSE, Nequi y Botón Bancolombia, y tiempos | Camilo con Wompi | Lanzar |
| P-18 | Railway: confirmar que el plan Hobby permite este uso | Camilo | Lanzar |

### 16.4 Diseño

| # | Pendiente | Quién | Antes de |
| --- | --- | --- | --- |
| P-19 | Sección de productos digitales en el mockup del admin | Diseño | Construir W14 |
| P-20 | Actualizar los mockups anteriores de checkout e inscripción al camp, que muestran el flujo viejo (envío Estándar/Express e inscripción fuera del carrito) | Diseño | Construir W6 y W8 |
| P-21 | Paradas, asistentes y aliados del VBall Tour en el mockup del admin | Diseño | Construir W15 |
| P-22 | Correos nuevos: compra digital, código de acceso, código para ceder un cupo, reembolso, cupo cedido y los del Tour | Diseño | Construir W9, W11b, W14 y W15 |
| P-23 | Página de preguntas frecuentes (FR-137) | Diseño | Construir W3 |
| P-24 | Corregir en los mockups lo que este documento ya decidió distinto: menú único con VBall Tour e ícono de "Mis compras" (FR-002); quitar "o de descuento" del campo de código y agregar el tipo de documento en "Carrito" (FR-024); cambiar "por WhatsApp o correo" en "VBall Tour" (FR-131); quitar "Menor de edad" en "Check-in" (FR-048); agregar el código al correo en "Ceder cupo" (FR-119). Mientras tanto manda este documento | Diseño | Construir cada pantalla |
| P-25 | Versión de celular de Tips (listado), Camps (listado), Nosotros, Contacto, App y páginas legales. No bloquea: se construyen desde el mockup de computador y `design-system.md` (NFR-007) | Diseño | Opcional |

### 16.5 Verificaciones técnicas

| # | Pendiente | Quién | Antes de |
| --- | --- | --- | --- |
| P-26 | Comprobar si Supabase Auth permite invalidar un código tras 5 intentos fallidos y mantener vigentes los ya enviados (FR-111). Si no, los códigos de "Mis compras" se manejan con lógica propia | Camilo | Construir W14 |
| P-27 | Definir cómo se emiten y guardan el enlace de 24 horas de "Tu compra digital" (FR-105) y el código para ceder un cupo (FR-119): Supabase Auth o tokens propios | Camilo | Construir W9 y W14 |

## 17. Historial de cambios

| Versión | Fecha | Cambios |
| --- | --- | --- |
| 1.0 | 3 nov 2026 | Primera versión en formato SRD |
| 1.1 | Nov 2026 | Reemplazo de la web actual y preparación para la app |
| 1.2 | Nov 2026 | Venta en el centro: carrito único y productos digitales |
| 1.3 | 11 nov 2026 | Documento consolidado. Decisiones nuevas: correo como llave y acceso seguro, reembolsos, precio y liquidación por camp, cancelación y cesión de cupo, envíos por zona, factura electrónica a futuro, Railway, sin analítica, Bunny Optimizer. Contradicciones corregidas: el valor fijo de $70.000 por participante, la fórmula de liquidación, los métodos de envío Estándar y Express, la factura obligatoria en cada venta, los tiempos de reserva y expiración (ahora 30 minutos), la ruta de rutinas y la lista de correos. Se agregaron el VBall Tour (sección 6.19) y la protección de formularios (sección 6.20) |
| 1.4 | 11 nov 2026 | Revisión previa al arranque del repositorio. Enlace de "Tu compra digital" de un solo uso y 24 horas (FR-085, FR-105). Búsqueda en el check-in por nombre o WhatsApp, lista sin conexión con hashes y lo que ve el staff (FR-048, FR-049). Confirmación del Tour en pantalla y correo solo si lo dejaron (FR-131). Casilla opcional para el recordatorio de carrito (FR-102). Ceder cupo con código al correo del comprador o con sesión (FR-119). Menú único y página de preguntas frecuentes (FR-002, FR-003, FR-137). Los pedidos con pago pendiente en Wompi no expiran, y el estado de pago se separa del estado de entrega (FR-029, FR-044, FR-099). Cupones de descuento fuera de la fase 1. Plan y precio prepagado por código de club (FR-037, FR-097, FR-116). Checkout en una sola página con secciones (FR-024, FR-098). Precio aproximado en dólares con tasa manual; la conversión automática pasa a la fase 3 (FR-010, FR-122). Presupuesto (BR-011). React Router 8 (CON-001, INT-006). 40 pantallas. Pendientes P-21 a P-27 |
