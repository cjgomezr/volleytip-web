import type { es } from "./messages/es";
import type { Language } from "./languages";

type SpanishMessages = typeof es;

export type MessageKey = keyof SpanishMessages;

/** Un texto que cambia con la cantidad: una forma por categoría de plural. */
export interface PluralMessage {
  readonly other: string;
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
}

/** Forma que debe tener el archivo de cada idioma. */
export type Messages = {
  readonly [Key in MessageKey]: SpanishMessages[Key] extends string
    ? string
    : PluralMessage;
};

type TemplateOf<
  Catalog,
  Key extends keyof Catalog,
> = Catalog[Key] extends string
  ? Catalog[Key]
  : Catalog[Key][keyof Catalog[Key]] & string;

type VariableNames<Template extends string> =
  Template extends `${string}{${infer Name}}${infer Rest}`
    ? Name | VariableNames<Rest>
    : never;

type VariableValues<Catalog, Key extends keyof Catalog> = {
  readonly [
    Name in VariableNames<TemplateOf<Catalog, Key>>
  ]: Name extends "count" ? number : string | number;
};

type TranslateArguments<Catalog, Key extends keyof Catalog> = [
  VariableNames<TemplateOf<Catalog, Key>>,
] extends [never]
  ? []
  : [values: VariableValues<Catalog, Key>];

/** El traductor de un catálogo: el real es `Translate`. */
export type TranslateFor<Catalog> = <Key extends keyof Catalog>(
  key: Key,
  ...values: TranslateArguments<Catalog, Key>
) => string;

export type Translate = TranslateFor<SpanishMessages>;

type RawValues = Readonly<Record<string, string | number>>;

function pickPluralForm(
  message: PluralMessage,
  count: number,
  language: string,
): string {
  if (count === 0 && message.zero !== undefined) return message.zero;
  const category = new Intl.PluralRules(language).select(count);
  return message[category] ?? message.other;
}

function fillVariables(template: string, values: RawValues): string {
  return template.replace(/\{(\w+)\}/g, (_placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`Falta el valor de "${name}" en el texto "${template}".`);
    }
    return String(value);
  });
}

/**
 * Devuelve texto plano. Un valor con `<` o `&` queda tal cual: escapar es
 * trabajo de quien pinta, y React lo hace al insertar un texto.
 */
export function createTranslate(
  messages: Messages,
  language: Language,
): Translate {
  return (key, ...[values]) => {
    const message: string | PluralMessage = messages[key];
    const rawValues: RawValues = values ?? {};
    if (typeof message === "string") return fillVariables(message, rawValues);
    const count = rawValues.count;
    if (typeof count !== "number") {
      throw new Error(`El texto "${key}" necesita un "count" numérico.`);
    }
    return fillVariables(pickPluralForm(message, count, language), rawValues);
  };
}
