import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";

export interface OfflineGuard {
  /** El último envío se detuvo porque no había red. */
  readonly isBlocked: boolean;
  readonly onSubmit: (event: FormEvent) => void;
}

/**
 * Para los formularios GET, que navegan (los filtros): sin red no se
 * envían. Enviarlos pediría datos que no llegan y la pantalla se reemplazaría
 * por la de error. Los que guardan usan `usePanelFetcher`, que además cubre un
 * servidor que no responde.
 */
export function useOfflineGuard(): OfflineGuard {
  const { key } = useLocation();
  // La dirección donde se detuvo el envío: al salir de ella el aviso vence.
  const [blockedAt, setBlockedAt] = useState<string | null>(null);
  if (blockedAt !== null && blockedAt !== key) setBlockedAt(null);
  return {
    isBlocked: blockedAt === key,
    onSubmit: (event) => {
      const isOffline = !navigator.onLine;
      if (isOffline) event.preventDefault();
      setBlockedAt(isOffline ? key : null);
    },
  };
}
