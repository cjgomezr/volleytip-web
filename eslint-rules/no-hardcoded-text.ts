import type { Rule } from "eslint";

// Ningún texto visible queda escrito en un componente (FR-006, AC-002). Se
// escribió una regla propia porque `react/jsx-no-literals` no distingue un
// `alt` de un `className`: con sus atributos activados marca todos.

/**
 * Nombres cuyo valor lo lee una persona, sea como atributo de una etiqueta,
 * como prop de un componente propio (`<TextField label="...">`) o como
 * propiedad de un objeto (`{ label: "Tienda" }`, el `title` de `meta()`).
 */
const WATCHED_NAMES: ReadonlySet<string> = new Set([
  "alt",
  "title",
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "hint",
  "text",
  "heading",
  "subtitle",
  "description",
  "caption",
  "message",
]);

// El `value` solo se lee en pantalla en estos `<input>`: es el texto del
// botón. En los demás es un dato.
const BUTTON_INPUT_TYPES: ReadonlySet<string> = new Set([
  "submit",
  "button",
  "reset",
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
  readonly operator?: string;
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
  readonly parent: {
    readonly name: { readonly name?: unknown };
    readonly attributes: readonly Partial<AttributeNode>[];
  };
}

interface PropertyNode {
  readonly computed: boolean;
  readonly key: { readonly name?: unknown; readonly value?: unknown };
  readonly value: ExpressionNode;
}

function hasWords(value: unknown): value is string {
  return typeof value === "string" && HAS_WORDS.test(value);
}

// Busca un texto escrito a mano dentro de una expresión: una cadena, una
// plantilla sin variables, o cualquiera de ellas en una condición, en un
// `&&` / `||` o pegada con `+`. Lo que se calcula (llamadas, variables) no
// se mira.
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
    case "BinaryExpression":
      return (
        node.operator === "+" &&
        (containsWords(node.left) || containsWords(node.right))
      );
    default:
      return false;
  }
}

function readsHandwrittenText(value: AttributeNode["value"]): boolean {
  if (value === null) return false;
  if (value.type === "Literal") return hasWords(value.value);
  return containsWords(value.expression);
}

function isButtonInput(element: AttributeNode["parent"]): boolean {
  if (element.name.name !== "input") return false;
  return element.attributes.some(
    (attribute) =>
      attribute.name?.name === "type" &&
      typeof attribute.value?.value === "string" &&
      BUTTON_INPUT_TYPES.has(attribute.value.value),
  );
}

function isWatchedAttribute(name: string, attribute: AttributeNode): boolean {
  if (name === "value") return isButtonInput(attribute.parent);
  return WATCHED_NAMES.has(name);
}

function propertyName({ computed, key }: PropertyNode): string | undefined {
  if (computed) return undefined;
  const name = key.name ?? key.value;
  return typeof name === "string" ? name : undefined;
}

export const noHardcodedText: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      text: "Texto visible escrito en el componente: muévelo a los archivos de traducción.",
      attribute:
        'El atributo "{{name}}" lleva un texto escrito a mano: sale de los archivos de traducción.',
      property:
        'La propiedad "{{name}}" lleva un texto escrito a mano: sale de los archivos de traducción.',
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
        if (typeof name !== "string" || !isWatchedAttribute(name, attribute)) {
          return;
        }
        if (readsHandwrittenText(attribute.value)) {
          context.report({ node, messageId: "attribute", data: { name } });
        }
      },
      Property(node: Rule.Node) {
        const property = node as unknown as PropertyNode;
        const name = propertyName(property);
        if (name === undefined || !WATCHED_NAMES.has(name)) return;
        if (containsWords(property.value)) {
          context.report({ node, messageId: "property", data: { name } });
        }
      },
    };
  },
};
