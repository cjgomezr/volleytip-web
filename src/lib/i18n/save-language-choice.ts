import type { Language } from "./languages";

const PRIMARY_BUTTON = 0;

interface ClickLike {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
}

/** Un clic que abre el enlace en esta pestaña. Los demás (nueva pestaña,
 * menú contextual) los resuelve el navegador y no guardan nada. */
export function isPlainLeftClick(click: ClickLike): boolean {
  return (
    !click.defaultPrevented &&
    click.button === PRIMARY_BUTTON &&
    !click.metaKey &&
    !click.ctrlKey &&
    !click.shiftKey &&
    !click.altKey
  );
}

/**
 * Guarda la elección del selector. La acción responde con una redirección que
 * aquí no hace falta: solo importa la cookie que deja. Si la petición falla no
 * se lanza nada: la persona igual quiere cambiar de página, y el selector
 * funciona como enlace sin la cookie.
 */
export async function saveLanguageChoice(
  language: Language,
  from: string,
): Promise<void> {
  try {
    await fetch("/idioma", {
      method: "POST",
      body: new URLSearchParams({ language, from }),
      redirect: "manual",
    });
  } catch {
    // El selector sigue funcionando como enlace sin la cookie.
  }
}
