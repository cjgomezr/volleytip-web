import type { LegalText } from "../legal-text-types";

export const termsEs: LegalText = {
  title: "Términos y condiciones",
  description:
    "Las reglas para usar volleytip.com, comprar en la tienda e inscribirte a los camps de VolleyTip.",
  blocks: [
    {
      type: "paragraph",
      text: "Estos términos regulan el uso de volleytip.com, sitio operado por VolleyTip, en Colombia. Al usar el sitio, aceptas estas reglas.",
    },
    { type: "heading", text: "Quién es VolleyTip" },
    {
      type: "paragraph",
      text: "VolleyTip es el responsable del sitio. Puedes escribirnos a team@volleytip.com.",
    },
    { type: "heading", text: "Qué ofrece el sitio" },
    {
      type: "list",
      items: [
        "Tips de voleibol y contenido del VBall Tour.",
        "Una tienda de productos físicos y digitales.",
        "La inscripción y el check-in de los Volleyball Camps.",
        "Formularios de contacto y listas de espera.",
      ],
    },
    { type: "heading", text: "Compras e inscripciones" },
    {
      type: "paragraph",
      text: "Los pagos se hacen con Wompi. Los precios se muestran en pesos colombianos y el cobro se hace en pesos. Las condiciones de envío, cambios, devoluciones y reembolsos se publicarán en sus propias páginas.",
    },
    { type: "heading", text: "Uso adecuado" },
    {
      type: "paragraph",
      text: "No puedes usar el sitio para dañarlo, para enviar mensajes automatizados ni para hacerte pasar por otra persona.",
    },
    { type: "heading", text: "Contenido" },
    {
      type: "paragraph",
      text: "Los videos, textos e imágenes del sitio son de VolleyTip o de quienes nos autorizaron a usarlos. No puedes copiarlos ni revenderlos sin permiso.",
    },
    { type: "heading", text: "Cambios y ley aplicable" },
    {
      type: "paragraph",
      text: "Podemos actualizar estos términos y cada versión lleva su número y su fecha. Se rigen por las leyes de Colombia.",
    },
  ],
};
