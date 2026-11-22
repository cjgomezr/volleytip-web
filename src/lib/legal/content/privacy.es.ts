import type { LegalText } from "../legal-text-types";

export const privacyEs: LegalText = {
  title: "Política de privacidad",
  description:
    "Qué datos pide VolleyTip, para qué los usa y cómo puedes pedir que los borremos.",
  blocks: [
    {
      type: "paragraph",
      text: "Esta política explica cómo VolleyTip trata tus datos personales, conforme a la Ley 1581 de 2012 de Colombia.",
    },
    { type: "heading", text: "Responsable del tratamiento" },
    {
      type: "paragraph",
      text: "VolleyTip, en Colombia. Correo de contacto: team@volleytip.com.",
    },
    { type: "heading", text: "Qué datos pedimos" },
    {
      type: "list",
      items: [
        "Formulario de contacto: tu nombre, tu correo y tu mensaje.",
        "Lista de espera: tu correo.",
        "Compras: los datos de entrega y de facturación que necesita el pedido.",
        "Inscripción a camps: los datos de quien participa y de su contacto.",
      ],
    },
    { type: "heading", text: "Para qué los usamos" },
    {
      type: "list",
      items: [
        "Responder tus mensajes.",
        "Avisarte cuando haya novedades que pediste.",
        "Entregar tus compras y gestionar tus inscripciones.",
      ],
    },
    { type: "heading", text: "Con quién los compartimos" },
    {
      type: "paragraph",
      text: "El pago lo procesa Wompi. Usamos proveedores de alojamiento y de envío de correos que tratan los datos solo para prestarnos su servicio.",
    },
    { type: "heading", text: "Tus derechos" },
    {
      type: "paragraph",
      text: "Puedes conocer, actualizar y corregir tus datos, y pedir que los borremos, escribiendo a team@volleytip.com. Los plazos de conservación se publicarán en el texto definitivo.",
    },
  ],
};
