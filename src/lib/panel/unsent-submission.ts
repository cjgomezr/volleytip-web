// Un envío del panel que no llegó al servidor (sin red). Corre en el
// navegador: sin esto, React Router trataría el fallo como un error de la
// pantalla y la reemplazaría, con lo que la persona había escrito.
import { data } from "react-router";

export interface UnsentSubmission {
  readonly status: "unsent";
}

// Con un estado de error React Router no vuelve a pedir los datos de la
// pantalla, que sin red fallaría y la reemplazaría igual.
const UNSENT_STATUS = 503;

// Lo que dicen Chrome, Firefox y Safari cuando `fetch` no llega a nadie. Se
// mira el mensaje además del tipo: un `TypeError` también es un fallo de
// código.
const CONNECTION_FAILURE =
  /failed to fetch|networkerror when attempting to fetch|load failed/i;

export function isConnectionFailure(error: unknown): boolean {
  return error instanceof TypeError && CONNECTION_FAILURE.test(error.message);
}

export type PanelSubmission<ServerResult> = Promise<
  ServerResult | ReturnType<typeof data<UnsentSubmission>>
>;

/**
 * El `clientAction` de las rutas del panel: envía y, si la petición no llegó,
 * lo responde como un resultado más. Un fallo del servidor y una redirección
 * siguen su camino.
 */
export async function sendPanelForm<ServerResult>(
  serverAction: () => Promise<ServerResult>,
): PanelSubmission<ServerResult> {
  try {
    return await serverAction();
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    return data<UnsentSubmission>(
      { status: "unsent" },
      { status: UNSENT_STATUS },
    );
  }
}

export function isUnsentSubmission(value: unknown): value is UnsentSubmission {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "unsent"
  );
}

/** Lo que respondió el servidor, o nada si el envío no llegó. */
export function withoutUnsent<Result>(
  result: Result,
): Exclude<Result, UnsentSubmission> | undefined {
  return isUnsentSubmission(result)
    ? undefined
    : (result as Exclude<Result, UnsentSubmission>);
}
