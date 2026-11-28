/**
 * Recarga la página si el navegador la restaura de su memoria al volver atrás
 * (`pageshow` con `persisted`). Un envío que salió hacia otro sitio sigue "en
 * curso" en esa copia, y React Router no lo termina nunca: espera que la
 * página se descargue. Devuelve cómo dejar de escuchar.
 */
export function reloadWhenRestored(
  target: EventTarget,
  reload: () => void,
): () => void {
  const handlePageShow = (event: Event): void => {
    if ((event as PageTransitionEvent).persisted) reload();
  };
  target.addEventListener("pageshow", handlePageShow);
  return () => target.removeEventListener("pageshow", handlePageShow);
}
