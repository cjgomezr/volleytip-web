import { createServiceSupabaseClient } from "~/lib/supabase/service-client.server";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";

/**
 * Lo que la protección de formularios guarda en la base (FR-135): el conteo
 * del límite por IP y los contadores de rechazos. Nada del envío llega aquí.
 */

/** Los motivos que acepta `form_rejections`. */
export type RejectionReason =
  "honeypot" | "too_fast" | "turnstile" | "rate_limit" | "validation";

export interface RateLimitCheck {
  /** Texto opaco: formulario más hash de la IP. */
  readonly key: string;
  readonly maxAttempts: number;
  readonly windowSeconds: number;
}

export interface FormStore {
  /** Cuenta el intento y dice si queda dentro del límite. */
  checkRateLimit(check: RateLimitCheck): Promise<boolean>;
  /** Suma 1 al contador de hoy de ese formulario y motivo. */
  recordRejection(form: string, reason: RejectionReason): Promise<void>;
}

/**
 * Guarda en Supabase con la llave de servicio, por las funciones
 * `check_rate_limit` y `record_form_rejection`. Las dos lanzan si la base
 * falla: un envío nunca se acepta sin haber consultado el límite.
 */
export function createSupabaseFormStore(
  client: TypedSupabaseClient = createServiceSupabaseClient(),
): FormStore {
  return {
    async checkRateLimit({ key, maxAttempts, windowSeconds }) {
      const { data, error } = await client.rpc("check_rate_limit", {
        p_key: key,
        p_max_attempts: maxAttempts,
        p_window_seconds: windowSeconds,
      });
      if (error !== null) {
        throw new Error(
          `No se pudo consultar el límite de envíos: ${error.message}`,
          { cause: error },
        );
      }
      return data;
    },
    async recordRejection(form, reason) {
      const { error } = await client.rpc("record_form_rejection", {
        p_form: form,
        p_reason: reason,
      });
      if (error !== null) {
        throw new Error(
          `No se pudo contar el rechazo "${reason}" de "${form}": ${error.message}`,
          { cause: error },
        );
      }
    },
  };
}
