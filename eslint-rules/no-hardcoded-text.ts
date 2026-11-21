import type { Rule } from "eslint";

// Ningún texto visible queda escrito en un componente (FR-006, AC-002). Se
// escribió una regla propia porque `react/jsx-no-literals` no distingue un
// `alt` de un `className`: con sus atributos activados marca todos.

/** Atributos cuyo valor lo lee una persona. */
const WATCHED_ATTRIBUTES: ReadonlySet<string> = new Set([
  "alt",
  "aria-label",
  "title",
  "placeholder",
]);

// Un asterisco, un guion o espacios no se traducen: solo cuenta lo que tenga
// una letra o un número.
const HAS_WORDS = /[\p{L}\p{N}]/u;

interface TextNode {
  readonly value: string;
  readonly loc: { readonly start: { readonly line: number } };
}

interface ExpressionNode {
  readonly type: string;
  readonly value?: unknown;
  readonly quasis?: readonly {
    readonly value: { readonly cooked?: string | null };
  }[];
  readonly expressions?: readonly unknown[];
  readonly consequent?: ExpressionNode;
  readonly alternate?: ExpressionNode;
  readonly left?: ExpressionNode;
  readonly right?: ExpressionNode;
}

interface ExpressionContainerNode {
  readonly parent: { readonly type: string };
  readonly expression: ExpressionNode;
}

interface AttributeNode {
  readonly name: { readonly name?: unknown };
  readonly value: (ExpressionNode & Partial<ExpressionContainerNode>) | null;
}

function hasWords(value: unknown): value is string {
  return typeof value === "string" && HAS_WORDS.test(value);
}

// Busca un texto escrito a mano dentro de una expresión: una cadena, una
// plantilla sin variables, o cualquiera de ellas en una condición o en un
// `&&` / `||`. Lo que se calcula (llamadas, variables) no se mira.
function containsWords(node: ExpressionNode | undefined): boolean {
  if (node === undefined) return false;
  switch (node.type) {
    case "Literal":
      return hasWords(node.value);
    case "TemplateLiteral":
      return (node.quasis ?? []).some(({ value }) => hasWords(value.cooked));
    case "ConditionalExpression":
      return containsWords(node.consequent) || containsWords(node.alternate);
    case "LogicalExpression":
      return containsWords(node.left) || containsWords(node.right);
    default:
      return false;
  }
}

function readsHandwrittenText(value: AttributeNode["value"]): boolean {
  if (value === null) return false;
  if (value.type === "Literal") return hasWords(value.value);
  return containsWords(value.expression);
}

export const noHardcodedText: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      text: "Texto visible escrito en el componente: muévelo a los archivos de traducción.",
      attribute:
        'El atributo "{{name}}" lleva un texto escrito a mano: sale de los archivos de traducción.',
    },
  },
  create(context) {
    return {
      JSXText(node: Rule.Node) {
        const { value, loc } = node as unknown as TextNode;
        if (!hasWords(value)) return;
        // La línea del texto, no la de la etiqueta que lo abre.
        const leading = value.slice(0, value.length - value.trimStart().length);
        const line = loc.start.line + leading.split("\n").length - 1;
        context.report({
          node,
          loc: { line, column: 0 },
          messageId: "text",
        });
      },
      JSXExpressionContainer(node: Rule.Node) {
        const { expression, parent } =
          node as unknown as ExpressionContainerNode;
        const isChild = parent.type !== "JSXAttribute";
        if (isChild && containsWords(expression)) {
          context.report({ node, messageId: "text" });
        }
      },
      JSXAttribute(node: Rule.Node) {
        const attribute = node as unknown as AttributeNode;
        const name = attribute.name.name;
        if (typeof name !== "string" || !WATCHED_ATTRIBUTES.has(name)) return;
        if (readsHandwrittenText(attribute.value)) {
          context.report({ node, messageId: "attribute", data: { name } });
        }
      },
    };
  },
};
