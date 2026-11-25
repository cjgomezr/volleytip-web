import type { ReactElement } from "react";
import { Form, useNavigation } from "react-router";

import { getPanelPath } from "~/lib/i18n/panel-pages";
import { useTranslate } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";

import { Button } from "./button";
import type { Zone } from "./pressable";

/** El botón "Cerrar sesión". Es un envío: funciona también sin JavaScript. */
export function PanelSignOut({
  zone = "light",
}: {
  readonly zone?: Zone;
}): ReactElement {
  const translate = useTranslate();
  const action = getPanelPath("adminSignOut", useLanguage());
  const isSigningOut = useNavigation().formAction === action;
  return (
    <Form method="post" action={action} className="flex flex-col">
      <Button
        type="submit"
        variant="secondary"
        zone={zone}
        submittingLabel={
          isSigningOut ? translate("panel.signOut.submitting") : undefined
        }
      >
        {translate("panel.signOut")}
      </Button>
    </Form>
  );
}
