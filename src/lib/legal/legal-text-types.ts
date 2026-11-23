// Un documento legal como datos tipados: títulos, párrafos y listas. Es el
// formato más simple que alcanza, y evita una dependencia para leer Markdown.
export type LegalBlock =
  | { readonly type: "heading"; readonly text: string }
  | { readonly type: "paragraph"; readonly text: string }
  | { readonly type: "list"; readonly items: readonly string[] };

export interface LegalText {
  readonly title: string;
  readonly description: string;
  readonly blocks: readonly LegalBlock[];
}
