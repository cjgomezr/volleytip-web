// Lo que comparten el servidor y la pantalla "Idiomas y mercados" (FR-065).

import type { MarketPaymentMethod } from "../payment-methods";
import type { MessageKey } from "../i18n/translate";

export interface PanelLanguage {
  readonly code: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
}

/** Lo que el admin puede cambiar de un mercado (FR-009). */
export interface MarketFormValues {
  readonly isActive: boolean;
  readonly shipsPhysical: boolean;
  readonly defaultLocale: string;
  readonly paymentMethods: readonly string[];
}

export interface PanelMarket extends MarketFormValues {
  readonly id: string;
  readonly countryCode: string;
  readonly currency: string;
}

export interface UsdRateView {
  readonly state: "set" | "missing" | "invalid";
  /** Lo guardado, como texto para el campo; vacío si no hay nada. */
  readonly value: string;
}

export interface MarketsView {
  readonly languages: readonly PanelLanguage[];
  readonly markets: readonly PanelMarket[];
  readonly usdRate: UsdRateView;
}

type Accepted = "saved" | "unchanged";

export type LanguageOutcome =
  | { readonly status: Accepted; readonly code: string }
  | {
      readonly status: "invalid";
      readonly code: string;
      readonly error: "defaultLanguage" | "malformed";
    };

export interface MarketFieldErrors {
  readonly defaultLocale?: "inactiveLanguage";
  readonly paymentMethods?: "unknownMethod";
}

export type MarketOutcome =
  | { readonly status: Accepted; readonly id: string }
  | {
      readonly status: "invalid";
      readonly id: string;
      /** Lo que se envió, para volver a pintarlo; ausente si llegó roto. */
      readonly values?: MarketFormValues;
      readonly errors: MarketFieldErrors;
      readonly formError: "lastActiveMarket" | "malformed" | null;
    };

export type RateError = "required" | "notPositiveInteger";

export type RateOutcome =
  | { readonly status: Accepted }
  | {
      readonly status: "invalid";
      readonly value: string;
      readonly error: RateError;
    };

/** Los nombres de los campos de los formularios. */
export const MARKETS_FIELDS = {
  code: "code",
  id: "id",
  isActive: "isActive",
  shipsPhysical: "shipsPhysical",
  defaultLocale: "defaultLocale",
  paymentMethods: "paymentMethods",
  rate: "rate",
} as const;

export const PAYMENT_METHOD_NAME_KEYS: Readonly<
  Record<MarketPaymentMethod, MessageKey>
> = {
  card: "panel.markets.method.card",
  pse: "panel.markets.method.pse",
  nequi: "panel.markets.method.nequi",
  bancolombia_button: "panel.markets.method.bancolombiaButton",
};
