import type { ReactElement } from "react";

import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { usePanelFetcher } from "~/lib/panel/use-panel-fetcher";

import { Button } from "./button";
import { UnsentNotice } from "./panel/unsent-notice";
import type { Zone } from "./pressable";
import { PreloadSubmission } from "./panel/preload-submission";

/** El botón "Cerrar sesión". Es un envío: funciona también sin JavaScript. */
export function PanelSignOut({
  zone = "light",
}: {
  readonly zone?: Zone;
}): ReactElement {
  const translate = useTranslate();
  const action = getPanelPath("adminSignOut", useLanguage());
  const fetcher = usePanelFetcher();
  return (
    <fetcher.Form method="post" action={action} className="flex flex-col gap-3">
      <PreloadSubmission action={action} />
      {fetcher.isUnsent ? <UnsentNotice zone={zone} /> : null}
      <Button
        type="submit"
        variant="secondary"
        zone={zone}
        submittingLabel={
          fetcher.isSending ? translate("panel.signOut.submitting") : undefined
        }
      >
        {translate("panel.signOut")}
      </Button>
    </fetcher.Form>
  );
}
