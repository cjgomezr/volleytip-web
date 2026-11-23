import { z } from "zod";

import { defineProtectedForm } from "./forms/protected-form.server";

// Largo máximo de una dirección de correo (RFC 5321).
const MAX_EMAIL_LENGTH = 254;
export const MAX_CITY_LENGTH = 80;

// Los mensajes son claves de traducción: el `action` las traduce al idioma
// de la página antes de devolverlas.
export const CAMP_NOTIFY_ERROR_KEYS = {
  email: "notify.error.email",
  city: "notify.error.city",
} as const;

const campNotifySchema = z.object({
  email: z
    .string()
    .trim()
    .max(MAX_EMAIL_LENGTH, CAMP_NOTIFY_ERROR_KEYS.email)
    .pipe(z.email(CAMP_NOTIFY_ERROR_KEYS.email)),
  // Opcional: un campo vacío se guarda sin ciudad.
  city: z
    .string()
    .trim()
    .max(MAX_CITY_LENGTH, CAMP_NOTIFY_ERROR_KEYS.city)
    .transform((city) => (city === "" ? null : city))
    .optional()
    .default(null),
});

export type CampNotifyErrorKey =
  (typeof CAMP_NOTIFY_ERROR_KEYS)[keyof typeof CAMP_NOTIFY_ERROR_KEYS];

export const CAMP_NOTIFY_FORM = defineProtectedForm({
  id: "camp_notify",
  schema: campNotifySchema,
});
