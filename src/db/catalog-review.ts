/**
 * Guardia del catálogo: toda tabla de `public` tiene RLS activado y declara
 * en su comentario si la comparte la app (`scope: shared`) o si es solo de la
 * web (`scope: web`), como pide FR-076.
 *
 * Aquí vive solo la decisión, sin base de datos. La consulta al catálogo
 * está en `catalog.integration.test.ts`.
 */

export const TABLE_SCOPES = ["shared", "web"] as const;

export type TableScope = (typeof TABLE_SCOPES)[number];

/** Lo que la revisión necesita saber de una tabla de `public`. */
export interface CatalogTable {
  readonly name: string;
  readonly hasRowLevelSecurity: boolean;
  readonly comment: string | null;
}

// El comentario abre con `scope: shared` o `scope: web`. Después puede seguir
// un punto y más texto.
const SCOPE_DECLARATION = /^scope: (shared|web)(?=$|[.\s])/;
const SCOPE_KEYWORD = /scope:/g;
const VALID_DECLARATIONS = TABLE_SCOPES.map(
  (scope) => `"scope: ${scope}"`,
).join(" o ");

function isTableScope(value: string | undefined): value is TableScope {
  return TABLE_SCOPES.some((scope) => scope === value);
}

/**
 * Lee el ámbito que declara el comentario de una tabla. Devuelve `null` si no
 * declara uno válido, o si declara más de uno: una tabla tiene un solo ámbito.
 */
export function readTableScope(comment: string | null): TableScope | null {
  if (comment === null) {
    return null;
  }
  const declarationCount = comment.match(SCOPE_KEYWORD)?.length ?? 0;
  if (declarationCount !== 1) {
    return null;
  }
  const scope = SCOPE_DECLARATION.exec(comment)?.[1];
  return isTableScope(scope) ? scope : null;
}

function describeScopeProblem(table: CatalogTable): string | null {
  if (readTableScope(table.comment) !== null) {
    return null;
  }
  if (table.comment === null) {
    return `La tabla public.${table.name} no tiene comentario. Debe empezar con ${VALID_DECLARATIONS}.`;
  }
  return `El comentario de la tabla public.${table.name} no declara un ámbito válido. Debe empezar con ${VALID_DECLARATIONS} y declarar uno solo. Comentario actual: "${table.comment}"`;
}

function describeTableProblems(table: CatalogTable): string[] {
  const problems: string[] = [];
  if (!table.hasRowLevelSecurity) {
    problems.push(
      `La tabla public.${table.name} no tiene RLS activado. Agrega "alter table public.${table.name} enable row level security" a su migración.`,
    );
  }
  const scopeProblem = describeScopeProblem(table);
  if (scopeProblem !== null) {
    problems.push(scopeProblem);
  }
  return problems;
}

/**
 * Revisa las tablas y devuelve un mensaje por cada problema, nombrando la
 * tabla. Una lista vacía significa que todo está bien.
 */
export function reviewCatalog(tables: readonly CatalogTable[]): string[] {
  return tables.flatMap(describeTableProblems);
}
