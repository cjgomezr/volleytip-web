import type { PluralMessage } from "./translate";

// Comprobaciones del CI sobre los archivos de traducción (AC-002). Solo miran
// que cada texto exista y sea coherente entre idiomas, no que esté bien
// traducido.

type MessageValue = string | PluralMessage;
export type Catalog = Readonly<Record<string, MessageValue>>;
export type CatalogSet = Readonly<Record<string, Catalog>>;

interface Entry {
  readonly language: string;
  readonly value: MessageValue;
}

const MAX_SAMPLED_COUNT = 1000;
const VARIABLE_PATTERN = /\{(\w+)\}/g;

function formsOf(value: MessageValue): readonly string[] {
  return typeof value === "string"
    ? [value]
    : Object.values(value).filter((form): form is string => form !== undefined);
}

function variablesOf(value: MessageValue): ReadonlySet<string> {
  const names = formsOf(value).flatMap((form) =>
    [...form.matchAll(VARIABLE_PATTERN)].map((match) => match[1] ?? ""),
  );
  return new Set(names);
}

function describeKind(value: MessageValue): "texto" | "plural" {
  return typeof value === "string" ? "texto" : "plural";
}

function checkPluralForms(
  key: string,
  language: string,
  value: PluralMessage,
): string[] {
  // Solo cuentan las formas que un entero corriente puede alcanzar: "many" en
  // español es para millones redondos y cae en "other".
  const rules = new Intl.PluralRules(language);
  const needed = Array.from({ length: MAX_SAMPLED_COUNT + 1 }, (_, count) =>
    rules.select(count),
  );
  return [...new Set([...needed, "other"])]
    .filter((category) => !(category in value))
    .map(
      (category) =>
        `La clave "${key}" no tiene la forma de plural "${category}" en "${language}".`,
    );
}

function checkOneEntry(key: string, { language, value }: Entry): string[] {
  const emptyIssues = formsOf(value)
    .filter((form) => form.trim() === "")
    .map(() => `La clave "${key}" está vacía en "${language}".`);
  const pluralIssues =
    typeof value === "string" ? [] : checkPluralForms(key, language, value);
  return [...emptyIssues, ...pluralIssues];
}

function compareWithReference(
  key: string,
  entry: Entry,
  reference: Entry,
): string[] {
  if (describeKind(entry.value) !== describeKind(reference.value)) {
    return [
      `La clave "${key}" es ${describeKind(entry.value)} en "${entry.language}" y ${describeKind(reference.value)} en "${reference.language}".`,
    ];
  }
  const own = variablesOf(entry.value);
  const expected = variablesOf(reference.value);
  const differing = [
    ...[...expected].filter((name) => !own.has(name)),
    ...[...own].filter((name) => !expected.has(name)),
  ];
  return differing.map(
    (name) =>
      `La clave "${key}" no tiene la variable "{${name}}" por igual en "${entry.language}" y en "${reference.language}".`,
  );
}

function checkKey(
  key: string,
  catalogs: CatalogSet,
  languages: readonly string[],
): string[] {
  const entries = languages.flatMap((language): Entry[] => {
    const value = catalogs[language]?.[key];
    return value === undefined ? [] : [{ language, value }];
  });
  const missing = languages
    .filter((language) => catalogs[language]?.[key] === undefined)
    .map((language) => `Falta la clave "${key}" en "${language}".`);
  const [reference, ...others] = entries;
  const mismatches = reference
    ? others.flatMap((entry) => compareWithReference(key, entry, reference))
    : [];
  return [
    ...missing,
    ...entries.flatMap((e) => checkOneEntry(key, e)),
    ...mismatches,
  ];
}

/** Devuelve un mensaje por cada problema; vacío si todo está bien. */
export function checkCatalogs(catalogs: CatalogSet): string[] {
  const languages = Object.keys(catalogs);
  const allKeys = new Set(
    languages.flatMap((language) => Object.keys(catalogs[language] ?? {})),
  );
  return [...allKeys].flatMap((key) => checkKey(key, catalogs, languages));
}

/**
 * Una clave se usa si algún archivo la escribe entre comillas. Una clave
 * armada en tiempo de ejecución no se puede comprobar, y el tipo de las claves
 * ya impide armarlas.
 */
export function findUnusedKeys(
  keys: readonly string[],
  sources: readonly string[],
): string[] {
  const isUsed = (key: string): boolean =>
    sources.some((source) =>
      [`"${key}"`, `'${key}'`, `\`${key}\``].some((quoted) =>
        source.includes(quoted),
      ),
    );
  return keys
    .filter((key) => !isUsed(key))
    .map((key) => `Ningún archivo de src usa la clave "${key}".`);
}
