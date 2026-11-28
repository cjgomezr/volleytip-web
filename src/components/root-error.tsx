import type { ReactElement } from "react";

import {
  ErrorContent,
  isServerError,
  ServerErrorPage,
} from "~/components/error-content";
import { ErrorInShell } from "~/components/error-in-shell";
import { LanguageSuggestion } from "~/components/language-suggestion";
import { MaintenancePage } from "~/components/maintenance-page";
import { findInactiveLanguageNotFound } from "~/lib/i18n/inactive-language-not-found";
import { DEFAULT_LANGUAGE } from "~/lib/i18n/languages";
import { TranslationsProvider } from "~/lib/i18n/translations-context";
import { useLanguage } from "~/lib/i18n/use-language";
import { findMaintenanceNotice } from "~/lib/maintenance-notice";
import { findPanelNotFound } from "~/lib/panel/panel-not-found";

/**
 * Lo que pinta la raíz para cada error. El 404 y los errores controlados de
 * una página del sitio los pinta el límite de `site-layout.tsx`, con la
 * cáscara. La excepción es el 404 del panel, que trae consigo lo que la
 * cáscara necesita: para quien no es del equipo tiene que verse como
 * cualquier página que no existe (AC-033). El límite del panel usa esto mismo
 * para lo que no es un fallo inesperado.
 */
export function RootError({
  error,
}: {
  readonly error: unknown;
}): ReactElement {
  const language = useLanguage();
  const panelNotFound = findPanelNotFound(error);
  if (panelNotFound !== undefined) {
    return (
      <TranslationsProvider
        language={language}
        messages={panelNotFound.messages}
      >
        <ErrorInShell
          error={error}
          announcements={panelNotFound.announcements}
          notice={
            panelNotFound.languageSuggestion ? (
              <LanguageSuggestion {...panelNotFound.languageSuggestion} />
            ) : null
          }
          year={panelNotFound.year}
        />
      </TranslationsProvider>
    );
  }
  const inactiveLanguage = findInactiveLanguageNotFound(error);
  if (inactiveLanguage !== undefined) {
    return (
      <TranslationsProvider
        language={DEFAULT_LANGUAGE}
        messages={inactiveLanguage.messages}
      >
        <ErrorInShell
          error={error}
          announcements={inactiveLanguage.announcements}
          year={inactiveLanguage.year}
        />
      </TranslationsProvider>
    );
  }
  const maintenance = findMaintenanceNotice(error);
  if (maintenance !== undefined) {
    return <MaintenancePage returnsAt={maintenance.returnsAt} />;
  }
  if (isServerError(error)) return <ServerErrorPage />;
  return (
    <main>
      <ErrorContent error={error} />
    </main>
  );
}
