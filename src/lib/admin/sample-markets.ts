import type { MarketsView } from "./markets";

// Los datos de muestra de "Idiomas y mercados" (/dev/mercados) y de sus
// pruebas. El panel real lee los suyos de la base.
export const SAMPLE_MARKETS_VIEW: MarketsView = {
  languages: [
    { code: "es", name: "Español", isDefault: true, isActive: true },
    { code: "en", name: "English", isDefault: false, isActive: true },
  ],
  markets: [
    {
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      countryCode: "CO",
      currency: "COP",
      defaultLocale: "es",
      shipsPhysical: true,
      paymentMethods: ["card", "pse"],
      isActive: true,
    },
  ],
  usdRate: { state: "set", value: "4150" },
};
