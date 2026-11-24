import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { Link, useLocation } from "react-router";

import { SUPPORTED_LANGUAGES } from "~/lib/i18n/languages";
import { findPageAtPath, type PageDeclaration } from "~/lib/i18n/page-path";
import { PAGES } from "~/lib/i18n/pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { getMenuEntries } from "~/lib/site-menu";
import { SOCIAL_NETWORKS } from "~/lib/social-links";

import { LanguageSwitcher } from "./language-switcher";
import { TRANSITION_STYLES } from "./pressable-styles";
import { FOOTER_ID } from "./site-footer";
import { SOCIAL_LABEL_KEYS, SocialIcon } from "./social-icons";

// Desde este ancho aparece el menú en línea y el de celular desaparece.
const INLINE_MENU_QUERY = "(min-width: 768px)";

const ROUND_BUTTON_STYLES = `inline-flex size-11 shrink-0 items-center justify-center rounded-pill border-2 border-brand-mist bg-transparent p-0 text-brand-mist no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;
// 48 px de alto y letra de 30 px (AC-022).
const ENTRY_STYLES = `flex min-h-12 items-center font-display text-[30px] leading-none uppercase no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;
const CURRENT_ENTRY_STYLES = "text-brand-lime";
const SOCIAL_LINK_STYLES = `inline-flex size-11 items-center justify-center rounded-pill text-brand-mist no-underline hovered:text-brand-lime ${TRANSITION_STYLES}`;

function subscribeToNothing(): () => void {
  return () => undefined;
}

/** Falso en el servidor y en el primer pintado; verdadero cuando ya hay JavaScript. */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function MenuIcon({ isClose }: { readonly isClose: boolean }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <path d={isClose ? "M5 5l14 14M19 5L5 19" : "M4 7h16M4 12h16M4 17h16"} />
    </svg>
  );
}

interface MobileMenuProps {
  /** Solo las pruebas la cambian: el sitio usa el mapa de páginas. */
  readonly pages?: readonly PageDeclaration[];
}

/**
 * El menú de celular: un botón que abre un diálogo a pantalla completa. Sin
 * JavaScript el botón es un enlace al pie, que lleva la navegación completa.
 */
export function MobileMenu({ pages = PAGES }: MobileMenuProps): ReactElement {
  const translate = useTranslate();
  const language = useLanguage();
  const { pathname } = useLocation();
  const isHydrated = useIsHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const currentId = findPageAtPath(pathname, pages, SUPPORTED_LANGUAGES)?.page
    .id;
  const entries = getMenuEntries(pages, language);

  function closeMenu(): void {
    setIsOpen(false);
    openerRef.current?.focus();
  }

  // El diálogo del navegador atrapa el foco y cierra con Escape; aquí solo se
  // sincroniza con el estado y se bloquea el desplazamiento de la página.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (!isOpen) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Si la pantalla crece con el menú abierto, el menú en línea toma su lugar.
  useEffect(() => {
    if (!isOpen) return;
    const query = window.matchMedia(INLINE_MENU_QUERY);
    function closeWhenInlineMenuAppears(event: MediaQueryListEvent): void {
      if (event.matches) closeMenu();
    }
    query.addEventListener("change", closeWhenInlineMenuAppears);
    return () => {
      query.removeEventListener("change", closeWhenInlineMenuAppears);
    };
  }, [isOpen]);

  return (
    <>
      {isHydrated ? (
        <button
          ref={openerRef}
          type="button"
          aria-label={translate("header.menuOpen")}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(true)}
          className={`${ROUND_BUTTON_STYLES} md:hidden`}
        >
          <MenuIcon isClose={false} />
        </button>
      ) : (
        <a
          href={`#${FOOTER_ID}`}
          aria-label={translate("header.menuOpen")}
          className={`${ROUND_BUTTON_STYLES} md:hidden`}
        >
          <MenuIcon isClose={false} />
        </a>
      )}
      <dialog
        ref={dialogRef}
        aria-label={translate("header.menuDialogLabel")}
        onClose={closeMenu}
        className="fixed inset-0 m-0 hidden h-dvh max-h-none w-full max-w-none overflow-y-auto bg-brand-night p-0 text-brand-mist open:flex open:flex-col md:hidden"
      >
        <div className="flex justify-end px-4 py-5">
          <button
            type="button"
            aria-label={translate("header.menuClose")}
            onClick={closeMenu}
            className={ROUND_BUTTON_STYLES}
          >
            <MenuIcon isClose />
          </button>
        </div>
        {entries.length === 0 ? (
          <div className="flex-1" />
        ) : (
          <nav
            aria-label={translate("header.menuLabel")}
            className="flex-1 px-4 py-4"
          >
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {entries.map((entry) => {
                const isCurrent = entry.id === currentId;
                return (
                  <li key={entry.id}>
                    <Link
                      to={entry.href}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={closeMenu}
                      className={`${ENTRY_STYLES} ${isCurrent ? CURRENT_ENTRY_STYLES : ""}`}
                    >
                      {translate(entry.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className="flex flex-col gap-6 px-4 py-8">
          <LanguageSwitcher label={translate("header.menuLanguageLabel")} />
          <ul
            aria-label={translate("footer.social.label")}
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {SOCIAL_NETWORKS.map(({ id, href }) => (
              <li key={id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={translate(SOCIAL_LABEL_KEYS[id])}
                  className={SOCIAL_LINK_STYLES}
                >
                  <SocialIcon network={id} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
