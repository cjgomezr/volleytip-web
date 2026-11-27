import { useState, type FormEvent } from "react";

export interface OfflineGuard {
  /** El último envío se detuvo porque no había red. */
  readonly isBlocked: boolean;
  readonly onSubmit: (event: FormEvent) => void;
}

/**
 * Para los formularios que navegan (los filtros y la entrada): sin red no se
 * envían. Enviarlos pediría datos que no llegan y la pantalla se reemplazaría
 * por la de error. Los que guardan usan `usePanelFetcher`, que además cubre un
 * servidor que no responde.
 */
export function useOfflineGuard(): OfflineGuard {
  const [isBlocked, setIsBlocked] = useState(false);
  return {
    isBlocked,
    onSubmit: (event) => {
      const isOffline = !navigator.onLine;
      if (isOffline) event.preventDefault();
      setIsBlocked(isOffline);
    },
  };
}
