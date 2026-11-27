import { useFetcher, type FetcherWithComponents } from "react-router";

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
  const result = fetcher.data as Outcome | UnsentSubmission | undefined;
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
