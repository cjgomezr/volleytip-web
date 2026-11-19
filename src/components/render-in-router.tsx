import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

/** Pinta un componente como lo haría el servidor. Los enlaces de React Router
 * necesitan un router alrededor. Solo para pruebas. */
export function renderInRouter(element: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}
