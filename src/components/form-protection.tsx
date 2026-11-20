import { useEffect, useRef, type ReactElement } from "react";
import { useNavigation } from "react-router";

import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "~/lib/forms/field-names";

/**
 * Lo que un formulario público necesita para pasar las capas de FR-135: la
 * marca de tiempo firmada, el campo trampa y el widget de Turnstile. Va
 * dentro del `<Form>`, con lo que devuelve `issueFormProtection` en el
 * `loader`.
 */

interface FormProtectionProps {
  /** Llave de sitio de Turnstile. Es pública. */
  readonly siteKey: string;
  /** Marca de tiempo firmada que emitió el servidor al pintar el formulario. */
  readonly timestamp: string;
}

interface TurnstileApi {
  /** Dibuja el widget y devuelve su identificador. */
  render(container: HTMLElement, options: { sitekey: string }): string;
  /** Pide un token nuevo: cada token sirve para un solo envío. */
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// `render=explicit`: el widget se dibuja cuando el componente se monta, no
// cuando carga el script. Así también aparece al llegar por navegación
// interna, con el script ya cargado.
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileLoading: Promise<TurnstileApi> | undefined;

function requestTurnstileScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => {
      if (window.turnstile === undefined) {
        reject(new Error("El script de Turnstile cargó sin su API"));
        return;
      }
      resolve(window.turnstile);
    });
    script.addEventListener("error", () => {
      script.remove();
      reject(new Error("No se pudo cargar el script de Turnstile"));
    });
    document.head.append(script);
  });
}

/** Carga el script una sola vez por página, aunque haya varios formularios. */
function loadTurnstile(): Promise<TurnstileApi> {
  turnstileLoading ??= requestTurnstileScript().catch((error: unknown) => {
    // Se olvida el intento fallido para que el próximo formulario reintente.
    turnstileLoading = undefined;
    throw error;
  });
  return turnstileLoading;
}

function TurnstileWidget({ siteKey }: { siteKey: string }): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const hasNavigated = useRef(false);
  const navigation = useNavigation();

  useEffect(() => {
    let isUnmounted = false;
    loadTurnstile().then(
      (turnstile) => {
        if (!isUnmounted && container.current !== null) {
          widgetId.current = turnstile.render(container.current, {
            sitekey: siteKey,
          });
        }
      },
      () => {
        // Sin el script no hay widget ni token, y el servidor responde
        // `verification_failed`: el formulario le dice a la persona que
        // intente de nuevo. Aquí no hay nada más que hacer.
      },
    );
    return (): void => {
      isUnmounted = true;
      if (widgetId.current !== undefined) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = undefined;
      }
    };
  }, [siteKey]);

  // Cuando el servidor termina de responder un envío, el token ya se gastó:
  // se pide otro para el siguiente intento.
  useEffect(() => {
    if (navigation.state !== "idle") {
      hasNavigated.current = true;
      return;
    }
    if (hasNavigated.current && widgetId.current !== undefined) {
      hasNavigated.current = false;
      window.turnstile?.reset(widgetId.current);
    }
  }, [navigation.state]);

  // 65 px es el alto del widget de Cloudflare: el espacio se reserva para
  // que el formulario no salte cuando aparece.
  return (
    <div ref={container} className="min-h-[65px]" data-sitekey={siteKey} />
  );
}

export function FormProtection({
  siteKey,
  timestamp,
}: FormProtectionProps): ReactElement {
  return (
    <>
      <input type="hidden" name={TIMESTAMP_FIELD} value={timestamp} />
      {/* Campo trampa: una persona no lo ve, no llega a él con el teclado y
          su lector de pantalla lo ignora. Va fuera de la vista y no con
          `display: none`, que muchos bots saben saltarse. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] size-px overflow-hidden"
      >
        <input
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <TurnstileWidget siteKey={siteKey} />
    </>
  );
}
