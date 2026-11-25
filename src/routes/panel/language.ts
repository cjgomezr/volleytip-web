import { data, redirect } from "react-router";

import { getPanelPathInLanguage } from "~/lib/admin/path-in-language";
import { getRequestLanguage, isSupportedLanguage } from "~/lib/i18n/languages";
import { getPanelPath, PANEL_PAGES } from "~/lib/i18n/panel-pages";
import {
  defineAdminAction,
  type AdminActionOutcome,
} from "~/lib/panel/admin-action.server";
import {
  panelMemberContext,
  panelSessionContext,
} from "~/lib/panel/panel-middleware.server";
import { savePanelLocale } from "~/lib/panel/save-panel-locale.server";

import type { Route } from "./+types/language";

const SEE_OTHER = 303;
const BAD_REQUEST = 400;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Abrir la dirección no cambia nada: cambiar de idioma es un envío.
export function loader({ request }: Route.LoaderArgs): Response {
  return redirect(getPanelPath("adminHome", getRequestLanguage(request)));
}

type LanguageResult = Response | ReturnType<typeof data<null>>;

async function changeLanguage({
  request,
  context,
}: Route.ActionArgs): Promise<AdminActionOutcome<LanguageResult, "locale">> {
  const formData = await request.formData();
  const language = readText(formData, "language");
  if (!isSupportedLanguage(language)) {
    return { result: data(null, { status: BAD_REQUEST }), change: null };
  }
  const memberId = context.get(panelMemberContext).id;
  const previous = await savePanelLocale({
    client: context.get(panelSessionContext).client,
    memberId,
    locale: language,
  });
  const destination = getPanelPathInLanguage(
    readText(formData, "from"),
    language,
    { pages: PANEL_PAGES, fallback: getPanelPath("adminHome", language) },
  );
  return {
    result: redirect(destination, SEE_OTHER),
    change: {
      entityId: memberId,
      before: { locale: previous },
      after: { locale: language },
    },
  };
}

export const action = defineAdminAction({
  name: "profile.set_locale",
  auditedFields: ["locale"],
  run: changeLanguage,
});

// Nunca se pinta: el loader y el action siempre responden antes. Hace falta
// para que la ruta sea una página y un 404 de la guardia salga con el
// documento.
export default function PanelLanguage(): null {
  return null;
}
