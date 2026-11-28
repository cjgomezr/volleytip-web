import { useState } from "react";
import {
  useFetcher,
  useLocation,
  type FetcherWithComponents,
} from "react-router";

import {
  isUnsentSubmission,
  withoutUnsent,
  type UnsentSubmission,
} from "./unsent-submission";

export interface PanelFetcher<Outcome> {
  readonly Form: FetcherWithComponents<unknown>["Form"];
  readonly isSending: boolean;
  /** El último envío no llegó al servidor. */
  readonly isUnsent: boolean;
  /** Lo que respondió el servidor al último envío. */
  readonly outcome: Outcome | undefined;
}

// React Router conserva `fetcher.data` mientras el formulario siga en
// pantalla, también después de un envío que redirigió. Sin esto, un rechazo o
// un aviso viejo seguiría ahí cuando el guardado siguiente ya funcionó. Una
// respuesta vence al salir de la dirección donde llegó, y no revive al volver
// con "atrás".
function useAnswerOfThisLocation(answer: unknown): unknown {
  const { key } = useLocation();
  const [received, setReceived] = useState({ answer, key, isExpired: false });
  if (received.answer !== answer) {
    setReceived({ answer, key, isExpired: false });
    return answer;
  }
  const isExpired = received.isExpired || received.key !== key;
  if (isExpired !== received.isExpired) setReceived({ ...received, isExpired });
  return isExpired ? undefined : answer;
}

/**
 * El `useFetcher` de un formulario del panel: separa la respuesta del
 * servidor de un envío que no llegó. Su ruta tiene que exportar el
 * `clientAction` que usa `sendPanelForm`.
 */
export function usePanelFetcher<Outcome = unknown>(
  /** La respuesta de un envío sin JavaScript. */
  initialOutcome?: Outcome,
): PanelFetcher<Outcome> {
  const fetcher = useFetcher();
  const result = useAnswerOfThisLocation(fetcher.data) as
    Outcome | UnsentSubmission | undefined;
  const isSending = fetcher.state !== "idle";
  return {
    Form: fetcher.Form,
    isSending,
    isUnsent: !isSending && isUnsentSubmission(result),
    outcome:
      result === undefined
        ? initialOutcome
        : (withoutUnsent(result) as Outcome | undefined),
  };
}
