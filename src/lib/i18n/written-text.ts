import ts from "typescript";

// Para las pruebas: encuentra en un archivo .tsx el texto que alguien verá u
// oirá y que no sale de las traducciones (FR-006). Lee el árbol del código y
// no el texto, así que no depende de cómo esté escrita la línea.

const READABLE_ATTRIBUTES: readonly string[] = [
  "aria-label",
  "alt",
  "title",
  "placeholder",
];
const LETTER = /\p{L}/u;

// Las cadenas que una expresión puede pintar. No entra en llamadas: el
// argumento de `translate("…")` es una clave, no un texto.
function literalsOf(expression: ts.Expression): string[] {
  if (ts.isStringLiteralLike(expression)) return [expression.text];
  if (ts.isTemplateExpression(expression)) {
    return [
      expression.head.text,
      ...expression.templateSpans.map(({ literal }) => literal.text),
    ];
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...literalsOf(expression.whenTrue),
      ...literalsOf(expression.whenFalse),
    ];
  }
  if (ts.isBinaryExpression(expression)) return literalsOf(expression.right);
  if (ts.isParenthesizedExpression(expression)) {
    return literalsOf(expression.expression);
  }
  return [];
}

function textsOfAttribute(attribute: ts.JsxAttribute): string[] {
  const { initializer, name } = attribute;
  if (!READABLE_ATTRIBUTES.includes(name.getText())) return [];
  if (initializer === undefined) return [];
  if (ts.isStringLiteral(initializer)) return [initializer.text];
  return ts.isJsxExpression(initializer) && initializer.expression
    ? literalsOf(initializer.expression)
    : [];
}

function textsOf(node: ts.Node): string[] {
  if (ts.isJsxText(node)) return [node.text];
  if (ts.isJsxAttribute(node)) return textsOfAttribute(node);
  const isChild =
    ts.isJsxExpression(node) &&
    (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent));
  return isChild && node.expression ? literalsOf(node.expression) : [];
}

/** Cada texto escrito a mano en el código de un componente. */
export function findWrittenText(source: string): string[] {
  const file = ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  function visit(node: ts.Node): void {
    found.push(...textsOf(node).filter((text) => LETTER.test(text)));
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found.map((text) => text.trim());
}
