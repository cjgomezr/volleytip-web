import { useSyncExternalStore } from "react";

function subscribeToNothing(): () => void {
  return () => {};
}

/** `false` en el servidor y sin JavaScript: para lo que solo se ofrece cuando
 * los controles ya responden. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
