// Textos del panel de administración y de su entrada.
export const panelEs = {
  "panel.eyebrow": "Panel de VolleyTip",
  "panel.overview.greeting": "Hola, {name}",
  "panel.overview.card.newMessages": "Mensajes sin responder",
  "panel.overview.card.appWaitlist": "Lista de espera de la app",
  "panel.overview.card.campNotify": "Inscritos en «Avísame»",
  "panel.overview.card.failed": "No se pudo cargar este dato.",
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
  "panel.module.overview": "Resumen",
  "panel.role.admin": "Administrador",
  "panel.role.staff": "Staff",
  "panel.language.label": "Idioma del panel",
  "panel.maintenance":
    "El modo mantenimiento está encendido: el sitio público no está disponible.",
  // Los módulos de la página de muestra (/dev/panel).
  "panel.sample.messages": "Mensajes",
  "panel.sample.siteTexts": "Textos del sitio",
  "panel.sample.faqs": "Preguntas frecuentes",
  "panel.sample.markets": "Idiomas y mercados",
  "panel.sample.settings": "Ajustes",
  "panel.sample.team": "Equipo",
  "panel.sample.auditLog": "Bitácora",
} as const;
