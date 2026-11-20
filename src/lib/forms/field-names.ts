/**
 * Nombres de los campos que la protección agrega a un formulario (FR-135).
 * Viven aparte de los módulos de servidor porque los comparten el servidor,
 * que los lee, y el componente, que los pinta.
 */

/** Campo trampa. Lleva un nombre que parece real: uno que se llamara
 * "trampa" no engaña a nadie. */
export const HONEYPOT_FIELD = "website";

/** Campo oculto con la marca de tiempo firmada. */
export const TIMESTAMP_FIELD = "form_started_at";
