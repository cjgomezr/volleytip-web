// Textos del panel de administración y de su entrada.
export const panelEs = {
  "panel.eyebrow": "Panel de VolleyTip",
  "panel.overview.greeting": "Hola, {name}",
  "panel.overview.card.newMessages": "Mensajes sin responder",
  "panel.overview.card.appWaitlist": "Lista de espera de la app",
  "panel.overview.card.campNotify": "Inscritos en «Avísame»",
  "panel.overview.card.failed": "No se pudo cargar este dato.",
  "panel.overview.retry": "Reintentar",
  "panel.overview.activity.title": "Actividad reciente",
  "panel.overview.activity.system": "Sistema",
  "panel.overview.activity.empty": "Todavía no hay actividad.",
  "panel.overview.activity.failed": "No se pudo cargar la actividad.",
  "panel.overview.rejections.title": "Envíos descartados",
  "panel.overview.rejections.total": "Últimos 7 días: {total}",
  "panel.overview.rejections.empty":
    "No se descartó ningún envío en los últimos 7 días.",
  "panel.overview.rejections.failed":
    "No se pudieron cargar los envíos descartados.",
  "panel.overview.form.contact": "Contacto",
  "panel.overview.form.appWaitlist": "Lista de espera de la app",
  "panel.overview.form.campNotify": "Avísame del próximo camp",
  "panel.overview.form.adminSignIn": "Entrada al panel",
  "panel.overview.reason.turnstile": "Verificación fallida",
  "panel.overview.reason.honeypot": "Campo trampa lleno",
  "panel.overview.reason.tooFast": "Envío demasiado rápido",
  "panel.overview.reason.rateLimit": "Demasiados intentos",
  "panel.overview.reason.validation": "Datos inválidos",
  "panel.staff.title": "Acceso de staff",
  "panel.staff.details":
    "Tu cuenta es para el escáner de entradas de un camp. El escáner todavía no está disponible y desde aquí no se ve el panel.",
  "panel.signIn.title": "Entrar al panel",
  "panel.signIn.heading": "Entrar",
  "panel.signIn.intro":
    "Te enviamos un enlace de acceso a tu correo. Sin contraseñas.",
  "panel.signIn.emailLabel": "Correo",
  "panel.signIn.emailPlaceholder": "tu@volleytip.com",
  "panel.signIn.submit": "Enviarme el enlace",
  "panel.signIn.submitting": "Enviando",
  "panel.signIn.teamOnly":
    "Solo entran los correos autorizados en Admin → Equipo.",
  "panel.signIn.hero.first": "Panel",
  "panel.signIn.hero.second": "VolleyTip",
  "panel.signIn.aside":
    "Solo para el equipo. ¿Eres staff de un camp? Usa el enlace y el PIN que te dieron.",
  "panel.signIn.sent.title": "Revisa tu correo",
  "panel.signIn.sent.details":
    "Si el correo es del equipo, te llega un enlace de un solo uso. Vence en una hora.",
  "panel.signIn.sent.another": "Usar otro correo",
  "panel.signIn.error.email": "Escribe un correo válido.",
  "panel.signIn.error.emailTooLong": "El correo es demasiado largo.",
  "panel.signIn.rejected.tooFast":
    "El envío llegó demasiado rápido. Inténtalo de nuevo.",
  "panel.signIn.rejected.verification":
    "No pudimos verificar que eres una persona. Inténtalo de nuevo.",
  "panel.signIn.rejected.rateLimited":
    "Demasiados intentos. Espera 10 minutos y prueba de nuevo.",
  "panel.signIn.unavailable":
    "No se pudo enviar el enlace. Inténtalo de nuevo más tarde.",
  "panel.signInLink.intro": "Pulsa el botón para entrar al panel.",
  "panel.signInLink.submit": "Entrar",
  "panel.signInLink.submitting": "Entrando",
  "panel.signInLink.unavailable":
    "No pudimos entrar en este momento. Inténtalo de nuevo más tarde.",
  "panel.signInLink.invalid.title": "Este enlace ya no sirve",
  "panel.signInLink.invalid.details":
    "Venció, ya se usó o está incompleto. Cada enlace sirve una sola vez y durante una hora.",
  "panel.signInLink.invalid.action": "Pedir otro enlace",
  "panel.signOut": "Cerrar sesión",
  "panel.signOut.submitting": "Cerrando sesión",
  "panel.brand": "volleytip",
  "panel.badge": "Admin",
  "panel.nav.label": "Secciones",
  "panel.nav.bottomLabel": "Secciones principales",
  "panel.nav.more": "Más",
  "panel.nav.pending": {
    one: "{count} pendiente",
    other: "{count} pendientes",
  },
  "panel.activity.entity": "Entidad: {entity}",
  "panel.module.overview": "Resumen",
  "panel.module.settings": "Ajustes",
  "panel.settings.currentState": "Estado actual:",
  "panel.settings.state.on": "Encendido",
  "panel.settings.state.off": "Apagado",
  "panel.settings.state.waitlist": "Lista de espera",
  "panel.settings.state.available": "Disponible",
  "panel.settings.state.invalid": "Valor inválido",
  "panel.settings.saving": "Guardando",
  "panel.settings.saved.maintenance": "El modo mantenimiento quedó guardado.",
  "panel.settings.saved.app": "El estado de la app quedó guardado.",
  "panel.settings.maintenance.title": "Modo mantenimiento",
  "panel.settings.maintenance.on":
    "El sitio público muestra la página de mantenimiento. El panel sigue funcionando.",
  "panel.settings.maintenance.off": "El sitio público se ve con normalidad.",
  "panel.settings.maintenance.invalid":
    "El valor guardado no se entiende y el sitio lo trata como apagado. Elige encender o apagar para corregirlo.",
  "panel.settings.maintenance.turnOn": "Encender mantenimiento",
  "panel.settings.maintenance.turnOff": "Apagar mantenimiento",
  "panel.settings.confirm.title": "Encender mantenimiento",
  "panel.settings.confirm.warning": "El sitio público dejará de verse.",
  "panel.settings.confirm.details":
    "Quien entre verá la página de mantenimiento en menos de un minuto. El panel y su pantalla de entrada seguirán funcionando, y puedes apagarlo cuando quieras.",
  "panel.settings.confirm.submit": "Sí, encender",
  "panel.settings.confirm.cancel": "Cancelar",
  "panel.settings.app.title": "Estado de la app",
  "panel.settings.app.details":
    "Decide qué muestra la página de la app: el formulario de la lista de espera o los botones de las tiendas.",
  "panel.settings.app.invalid":
    "El valor guardado no sirve y la página de la app no lo muestra como corresponde. Corrígelo y guarda.",
  "panel.settings.app.statusLabel": "La app está",
  "panel.settings.app.appStoreLabel": "Dirección en App Store",
  "panel.settings.app.appStoreHint":
    "Empieza por https://apps.apple.com/. En lista de espera, un campo vacío conserva la dirección guardada.",
  "panel.settings.app.playStoreLabel": "Dirección en Google Play",
  "panel.settings.app.playStoreHint":
    "Empieza por https://play.google.com/. En lista de espera, un campo vacío conserva la dirección guardada.",
  "panel.settings.app.save": "Guardar estado de la app",
  "panel.settings.app.error.summary":
    "No se guardó. Revisa los campos marcados.",
  "panel.settings.app.error.status": "Elige lista de espera o disponible.",
  "panel.settings.app.error.missingUrl":
    "Para dejarla disponible, escribe al menos una dirección de tienda.",
  "panel.settings.app.error.appStoreUrl":
    "Escribe una dirección de App Store que empiece por https://apps.apple.com/ y no tenga espacios.",
  "panel.settings.app.error.playStoreUrl":
    "Escribe una dirección de Google Play que empiece por https://play.google.com/ y no tenga espacios.",
  "panel.role.admin": "Administrador",
  "panel.role.staff": "Staff",
  "panel.language.label": "Idioma del panel",
  "panel.maintenance":
    "El modo mantenimiento está encendido: el sitio público no está disponible.",
  "panel.module.siteTexts": "Textos del sitio",
  "panel.siteTexts.bar.title": "Barra de anuncios",
  "panel.siteTexts.bar.intro":
    "Los avisos de arriba del sitio. En celular solo se ve el primero.",
  "panel.siteTexts.bar.empty":
    "No hay mensajes. Si guardas así, la barra no se muestra.",
  "panel.siteTexts.bar.message": "Mensaje {number}",
  "panel.siteTexts.bar.textEs": "Texto en español",
  "panel.siteTexts.bar.textEn": "Texto en inglés",
  "panel.siteTexts.bar.missingEnglish":
    "Sin texto en inglés: en /en/ saldrá en español.",
  "panel.siteTexts.bar.up": "Subir",
  "panel.siteTexts.bar.upLabel": "Subir el mensaje {number}",
  "panel.siteTexts.bar.down": "Bajar",
  "panel.siteTexts.bar.downLabel": "Bajar el mensaje {number}",
  "panel.siteTexts.bar.remove": "Quitar",
  "panel.siteTexts.bar.removeLabel": "Quitar el mensaje {number}",
  "panel.siteTexts.bar.moved": "El mensaje quedó en la posición {number}.",
  "panel.siteTexts.bar.removed": "Se quitó el mensaje {number}.",
  "panel.siteTexts.bar.add": "Agregar mensaje",
  "panel.siteTexts.bar.max": "Máximo {max} mensajes.",
  "panel.siteTexts.bar.save": "Guardar barra",
  "panel.siteTexts.bar.tooMany":
    "La barra admite máximo {max} mensajes. Quita los que sobran.",
  "panel.siteTexts.error.malformed":
    "El envío llegó incompleto. Recarga la pantalla e inténtalo de nuevo.",
  "panel.siteTexts.bar.invalidStored":
    "El valor guardado de la barra no tiene la forma esperada y el sitio no la muestra. Revisa los mensajes y guarda para reemplazarlo.",
  "panel.siteTexts.bar.storedValue": "Valor guardado",
  "panel.siteTexts.stats.title": "Cifras de la home",
  "panel.siteTexts.stats.intro":
    "Una cifra sin valor o sin etiqueta no se muestra. En inglés, lo que quede vacío sale en español. Máximo {value} caracteres en el valor y {label} en la etiqueta.",
  "panel.siteTexts.stats.instagram": "Instagram",
  "panel.siteTexts.stats.tiktok": "TikTok",
  "panel.siteTexts.stats.views": "Vistas",
  "panel.siteTexts.stats.region": "Región",
  "panel.siteTexts.stats.valueEs": "Valor en español",
  "panel.siteTexts.stats.valueEn": "Valor en inglés",
  "panel.siteTexts.stats.labelEs": "Etiqueta en español",
  "panel.siteTexts.stats.labelEn": "Etiqueta en inglés",
  "panel.siteTexts.stats.save": "Guardar cifras",
  "panel.siteTexts.maxLength": "Máximo {max} caracteres.",
  "panel.siteTexts.error.required": "Escribe el texto en español.",
  "panel.siteTexts.error.notSaved": "No se guardó.",
  "panel.siteTexts.error.summary": "No se guardó. Revisa lo marcado.",
  "panel.siteTexts.saving": "Guardando",
  "panel.siteTexts.saved": "Cambios guardados.",
  "panel.siteTexts.unchanged": "No había cambios que guardar.",
  // Los módulos de la página de muestra (/dev/panel).
  "panel.sample.messages": "Mensajes",
  "panel.sample.siteTexts": "Textos del sitio",
  "panel.sample.faqs": "Preguntas frecuentes",
  "panel.sample.markets": "Idiomas y mercados",
  "panel.sample.team": "Equipo",
  "panel.sample.auditLog": "Bitácora",
} as const;
