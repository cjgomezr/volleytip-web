import { createContext, useContext } from "react";

import type { PanelNavigation } from "~/lib/admin/navigation";

export const PanelNavigationContext = createContext<PanelNavigation | null>(
  null,
);

/** La navegación que armó la cáscara. La usa la pantalla "Más". */
export function usePanelNavigation(): PanelNavigation {
  const navigation = useContext(PanelNavigationContext);
  if (navigation === null) {
    throw new Error("usePanelNavigation va dentro de PanelShell.");
  }
  return navigation;
}
