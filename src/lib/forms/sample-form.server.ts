import { z } from "zod";

import { defineProtectedForm } from "./protected-form.server";

/**
 * Formulario de ejemplo de la página de muestra (`/dev/componentes`). Sirve
 * para ver las cinco capas funcionando en un entorno real. No guarda nada:
 * lo aceptado se descarta. Los textos son datos de prueba.
 */

// Largo máximo de una dirección de correo (RFC 5321).
const MAX_EMAIL_LENGTH = 254;

const sampleSchema = z.object({
  email: z
    .string()
    .trim()
    .max(MAX_EMAIL_LENGTH, "El correo es demasiado largo")
    .pipe(z.email("Escribe un correo válido")),
});

export const SAMPLE_FORM = defineProtectedForm({
  id: "dev_sample",
  schema: sampleSchema,
});
