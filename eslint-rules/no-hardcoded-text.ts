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

interface LiteralNode {
  readonly type: "Literal";
  readonly value: unknown;
}

interface TextNode {
  readonly value: string;
  readonly loc: { readonly start: { readonly line: number } };
}

interface ExpressionContainerNode {
  readonly parent: { readonly type: string };
  readonly expression: { readonly type: string; readonly value?: unknown };
}

interface AttributeNode {
  readonly name: { readonly name?: unknown };
  readonly value:
    LiteralNode | ({ readonly type: string } & ExpressionContainerNode) | null;
}

function hasWords(value: unknown): value is string {
  return typeof value === "string" && HAS_WORDS.test(value);
}

function readStringValue(value: AttributeNode["value"]): unknown {
  if (value === null) return undefined;
  if (value.type === "Literal") return (value as LiteralNode).value;
  const { expression } = value as ExpressionContainerNode;
  return expression.type === "Literal" ? expression.value : undefined;
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
        if (
          isChild &&
          expression.type === "Literal" &&
          hasWords(expression.value)
        ) {
          context.report({ node, messageId: "text" });
        }
      },
      JSXAttribute(node: Rule.Node) {
        const attribute = node as unknown as AttributeNode;
        const name = attribute.name.name;
        if (typeof name !== "string" || !WATCHED_ATTRIBUTES.has(name)) return;
        if (hasWords(readStringValue(attribute.value))) {
          context.report({ node, messageId: "attribute", data: { name } });
        }
      },
    };
  },
};
