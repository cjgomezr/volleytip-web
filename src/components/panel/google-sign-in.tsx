import { useEffect, type ReactElement } from "react";
import { useSearchParams } from "react-router";

import { Pressable } from "~/components/pressable";
import {
  DISABLED_STYLES,
  TRANSITION_STYLES,
} from "~/components/pressable-styles";
import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { reloadWhenRestored } from "~/lib/panel/reload-when-restored";
import { RETURN_PARAM } from "~/lib/panel/return-path";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";
import { usePreloadSubmission } from "~/lib/panel/use-preload-submission";

import { UnsentNotice } from "./unsent-notice";

const LOGO_SIZE = 20;

// La pauta de marca de Google para el botón claro: fondo blanco, borde de
// 1px, texto oscuro en Google Sans Medium 14/20, logo a color a 12px del
// borde y 10px del texto. La forma de píldora la permite la pauta.
const BUTTON_STYLES =
  "inline-flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-pill border border-google-stroke bg-google-surface px-3 py-2 font-google text-[14px] leading-[20px] font-medium text-google-ink focused:outline-brand-night";
const INTERACTIVE_STYLES = "hovered:bg-google-hover pressed:bg-google-pressed";

function Separator(): ReactElement {
  const translate = useTranslate();
  return (
    <p className="my-4 flex items-center gap-4 text-[14px] text-ink-subtle before:h-px before:flex-1 before:bg-brand-mist after:h-px after:flex-1 after:bg-brand-mist">
      {translate("panel.signIn.google.separator")}
    </p>
  );
}

/**
 * "Continuar con Google", debajo del formulario del enlace. Es un envío:
 * funciona también sin JavaScript, y sin red lo dice sin cambiar la pantalla.
 */
export function GoogleSignIn(): ReactElement {
  const translate = useTranslate();
  const action = getPanelPath("adminSignInGoogle", useLanguage());
  const [params] = useSearchParams();
  const returnPath = params.get(RETURN_PARAM);
  const fetcher = usePanelFetcher();
  usePreloadSubmission("adminSignInGoogle");
  const { isSending } = fetcher;
  // Quien cancela con "atrás" en Google no puede quedarse con un botón muerto.
  useEffect(() => {
    if (!isSending) return undefined;
    return reloadWhenRestored(window, () => window.location.reload());
  }, [isSending]);
  return (
    <>
      <Separator />
      <fetcher.Form
        method="post"
        action={action}
        className="flex flex-col gap-3"
      >
        {fetcher.isUnsent ? <UnsentNotice /> : null}
        {returnPath === null ? null : (
          <input type="hidden" name={RETURN_PARAM} value={returnPath} />
        )}
        <Pressable
          type="submit"
          submittingLabel={
            fetcher.isSending
              ? translate("panel.signIn.google.submitting")
              : undefined
          }
          className={`${BUTTON_STYLES} ${TRANSITION_STYLES} ${
            fetcher.isSending ? DISABLED_STYLES : INTERACTIVE_STYLES
          }`}
        >
          <img
            src="/brand/google-g.svg"
            alt=""
            width={LOGO_SIZE}
            height={LOGO_SIZE}
          />
          {translate("panel.signIn.google.button")}
        </Pressable>
      </fetcher.Form>
    </>
  );
}
