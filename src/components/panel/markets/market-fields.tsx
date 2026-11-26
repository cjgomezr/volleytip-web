import { useId, type ReactElement } from "react";

import {
  MARKETS_FIELDS,
  PAYMENT_METHOD_NAME_KEYS,
  type MarketFormValues,
  type MarketOutcome,
  type PanelLanguage,
} from "~/lib/admin/markets";
import { useTranslate } from "~/lib/i18n/translations-context";
import { MARKET_PAYMENT_METHODS } from "~/lib/payment-methods";

import { SelectField } from "../../select-field";
import { FieldError, MarketCheckbox } from "./market-checkbox";

type Rejection = Extract<MarketOutcome, { status: "invalid" }>;

interface FieldsProps {
  readonly values: MarketFormValues;
  readonly rejection: Rejection | undefined;
}

// El "false" oculto distingue una casilla sin marcar de un envío roto.
function SwitchFields({ values, rejection }: FieldsProps): ReactElement {
  const translate = useTranslate();
  const errorId = useId();
  const isLastActive = rejection?.formError === "lastActiveMarket";
  return (
    <div className="flex flex-col">
      <input type="hidden" name={MARKETS_FIELDS.isActive} value="false" />
      <MarketCheckbox
        name={MARKETS_FIELDS.isActive}
        label={translate("panel.markets.market.isActive")}
        isChecked={values.isActive}
        errorId={isLastActive ? errorId : undefined}
      />
      {isLastActive ? (
        <FieldError
          id={errorId}
          text={translate("panel.markets.error.lastActiveMarket")}
        />
      ) : null}
      <input type="hidden" name={MARKETS_FIELDS.shipsPhysical} value="false" />
      <MarketCheckbox
        name={MARKETS_FIELDS.shipsPhysical}
        label={translate("panel.markets.market.shipsPhysical")}
        isChecked={values.shipsPhysical}
      />
    </div>
  );
}

// Solo se ofrecen los idiomas activos. Si el del mercado dejó de estarlo, el
// selector pide elegir otro en vez de mostrar el primero como si fuera suyo.
function LocaleField({
  values,
  rejection,
  languages,
}: FieldsProps & {
  readonly languages: readonly PanelLanguage[];
}): ReactElement {
  const translate = useTranslate();
  const active = languages
    .filter(({ isActive }) => isActive)
    .map(({ code, name }) => ({ value: code, label: name }));
  const isOffered = active.some(({ value }) => value === values.defaultLocale);
  const placeholder = {
    value: "",
    label: translate("panel.markets.market.chooseLanguage"),
  };
  return (
    <SelectField
      // La lista cambia al activar o desactivar un idioma: se vuelve a montar
      // para que quede elegido el que corresponde.
      key={active.map(({ value }) => value).join()}
      zone="light"
      name={MARKETS_FIELDS.defaultLocale}
      label={translate("panel.markets.market.defaultLocale")}
      options={isOffered ? active : [placeholder, ...active]}
      defaultValue={isOffered ? values.defaultLocale : ""}
      error={
        rejection?.errors.defaultLocale === undefined
          ? undefined
          : translate("panel.markets.error.inactiveLanguage")
      }
    />
  );
}

function PaymentMethodFields({ values, rejection }: FieldsProps): ReactElement {
  const translate = useTranslate();
  const errorId = useId();
  const hasError = rejection?.errors.paymentMethods !== undefined;
  return (
    <fieldset
      className="m-0 min-w-0 border-0 p-0"
      aria-describedby={hasError ? errorId : undefined}
    >
      <legend className="mb-1.5 p-0 text-[14px] font-bold">
        {translate("panel.markets.market.paymentMethods")}
      </legend>
      <div className="flex flex-wrap gap-x-6">
        {MARKET_PAYMENT_METHODS.map((method) => (
          <MarketCheckbox
            key={method}
            name={MARKETS_FIELDS.paymentMethods}
            value={method}
            label={translate(PAYMENT_METHOD_NAME_KEYS[method])}
            isChecked={values.paymentMethods.includes(method)}
          />
        ))}
      </div>
      {hasError ? (
        <FieldError
          id={errorId}
          text={translate("panel.markets.error.unknownMethod")}
        />
      ) : null}
    </fieldset>
  );
}

/** Los campos que el admin puede cambiar de un mercado. */
export function MarketFields({
  languages,
  ...fields
}: FieldsProps & {
  readonly languages: readonly PanelLanguage[];
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <SwitchFields {...fields} />
      <LocaleField {...fields} languages={languages} />
      <PaymentMethodFields {...fields} />
    </div>
  );
}
