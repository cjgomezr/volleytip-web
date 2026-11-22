import type { ReactElement } from "react";
import { isRouteErrorResponse } from "react-router";

import { ERROR_MESSAGES } from "~/lib/i18n/messages/errors";
import { useLanguage } from "~/lib/i18n/use-language";

const NOT_FOUND_STATUS = 404;

interface ErrorSummary {
  readonly title: string;
  readonly details: string;
}

// No usa `useTranslate`: los textos de la raíz pueden faltar justo cuando
// hay que pintar un error (un fallo en el middleware o en el loader de la
// raíz, un método que React Router rechaza). Los de la página de error
// viajan siempre con el código.
function useErrorSummary(error: unknown): ErrorSummary {
  const messages = ERROR_MESSAGES[useLanguage()];
  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    return {
      title: messages["error.notFoundTitle"],
      details: messages["error.notFoundDetails"],
    };
  }
  if (import.meta.env.DEV && error instanceof Error) {
    return { title: messages["error.genericTitle"], details: error.message };
  }
  return {
    title: messages["error.genericTitle"],
    details: messages["error.genericDetails"],
  };
}

/** El título y el detalle de un error, para ponerlos dentro de un `<main>`. */
export function ErrorContent({
  error,
}: {
  readonly error: unknown;
}): ReactElement {
  const { title, details } = useErrorSummary(error);
  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-12 pb-24">
      <title>{title}</title>
      <h1 className="font-display text-[56px] leading-[0.95] uppercase">
        {title}
      </h1>
      <p className="mt-6 text-[16px] leading-[1.5] text-ink-muted">{details}</p>
    </div>
  );
}
