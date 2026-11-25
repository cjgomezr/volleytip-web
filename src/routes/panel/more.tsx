import type { ReactElement } from "react";

import { PanelMore } from "~/components/panel/panel-more";

// Sin datos propios: los pone la cáscara. El loader existe para que la
// guardia corra también al navegar sin recargar.
export function loader(): null {
  return null;
}

export default function More(): ReactElement {
  return <PanelMore />;
}
