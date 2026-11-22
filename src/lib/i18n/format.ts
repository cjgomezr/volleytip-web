import type { Language } from "./languages";

// Las monedas que conoce el sitio. La cantidad de decimales sale de `Intl`;
// lo único fijo a mano es que el peso se muestra sin ellos.
const SUPPORTED_CURRENCIES = ["COP", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Dinero siempre como entero en la unidad menor de su moneda (centavos). */
export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

const SITE_TIME_ZONE = "America/Bogota";
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const DECIMAL_BASE = 10;
// DR-001: todo monto se guarda en centavos, también el peso aunque se
// muestre sin decimales.
const STORED_MINOR_UNIT_DIGITS = 2;
const PADDED_DIGITS = 2;

const LOCALE_BY_LANGUAGE = {
  es: "es-CO",
  en: "en-US",
} as const satisfies Record<Language, string>;

const WHOLE_UNIT_CURRENCIES: ReadonlySet<Currency> = new Set(["COP"]);

// El español separa el símbolo de la cifra con un espacio duro; el sitio lo
// muestra pegado (`$120.000`).
const SPACE_AFTER_SYMBOL = /(\D)\u00a0(?=\d)/;

export function isSupportedCurrency(code: string): code is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

function getDisplayDigits(currency: Currency): number {
  if (WHOLE_UNIT_CURRENCIES.has(currency)) return 0;
  const { maximumFractionDigits } = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).resolvedOptions();
  return maximumFractionDigits ?? 0;
}

// El monto en la unidad mayor, ya redondeado a los decimales que se
// muestran. Se redondea aquí, con enteros, y no dentro de `Intl`: así unos
// centavos negativos que el peso redondea a nada dan un 0 limpio y no salen
// como `-$0`, igual que el `-0`. La mitad se aleja del cero (50 centavos
// suben al peso siguiente).
function roundToShownDigits(amount: number, shownDigits: number): number {
  const hiddenDigits = STORED_MINOR_UNIT_DIGITS - shownDigits;
  const shownUnits = Math.round(
    Math.abs(amount) / DECIMAL_BASE ** hiddenDigits,
  );
  if (shownUnits === 0) return 0;
  return (Math.sign(amount) * shownUnits) / DECIMAL_BASE ** shownDigits;
}

/** `$120.000` en español, `COP 120,000` en inglés. Falla si el monto no es
 * un entero seguro o si el sitio no conoce la moneda. */
export function formatMoney(money: Money, language: Language): string {
  const { amount, currency } = money;
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`El monto debe ser un entero seguro, llegó ${amount}.`);
  }
  if (!isSupportedCurrency(currency)) {
    throw new Error(`Moneda desconocida: ${String(currency)}.`);
  }
  const shownDigits = getDisplayDigits(currency);
  const formatted = new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], {
    style: "currency",
    currency,
    minimumFractionDigits: shownDigits,
    maximumFractionDigits: shownDigits,
  }).format(roundToShownDigits(amount, shownDigits));
  return language === "es"
    ? formatted.replace(SPACE_AFTER_SYMBOL, "$1")
    : formatted;
}

export interface DateFormatOptions {
  readonly style?: "long" | "short";
  readonly withTime?: boolean;
}

/** Fecha en el idioma de la página y en la hora de Colombia, no la del
 * servidor. */
export function formatDate(
  date: Date,
  language: Language,
  { style = "long", withTime = false }: DateFormatOptions = {},
): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha es inválida.");
  }
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    dateStyle: style,
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: SITE_TIME_ZONE,
  }).format(date);
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language]).format(value);
}

function padTwoDigits(value: number): string {
  return String(value).padStart(PADDED_DIGITS, "0");
}

/** Segundos como `1:05`, o `1:02:05` si llega a la hora. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isSafeInteger(totalSeconds) || totalSeconds < 0) {
    throw new Error(
      `La duración debe ser un entero de segundos no negativo, llegó ${totalSeconds}.`,
    );
  }
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours === 0) return `${minutes}:${padTwoDigits(seconds)}`;
  return `${hours}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
}
