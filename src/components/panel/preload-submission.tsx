import { useSyncExternalStore, type ReactElement } from "react";
import { PrefetchPageLinks } from "react-router";

// Nada que escuchar: solo cambia entre el servidor y el navegador.
const subscribeToNothing = (): (() => void) => () => undefined;

/**
 * Trae por adelantado la ruta a la que envía un formulario. React Router
 * necesita su módulo en el navegador para enviar y, si al enviar no hay red y
 * no lo tiene, recarga la página: se pierde lo escrito. Va junto a cada
 * formulario que envía a una dirección distinta de la de su pantalla.
 */
export function PreloadSubmission({
  action,
}: {
  readonly action: string;
}): ReactElement | null {
  // Solo en el navegador: sin JavaScript no hay nada que precargar.
  const isInBrowser = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  return isInBrowser ? <PrefetchPageLinks page={action} /> : null;
}
