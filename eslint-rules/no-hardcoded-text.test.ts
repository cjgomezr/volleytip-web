import tseslint from "typescript-eslint";
import { RuleTester } from "eslint";
import { describe, expect, it } from "vitest";

import { noHardcodedText } from "./no-hardcoded-text.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe("guardia de textos: lint", () => {
  tester.run("no-hardcoded-text", noHardcodedText, {
    valid: [
      { code: `const a = <div className="flex mt-4">{t("x")}</div>;` },
      {
        code: `const a = <input type="email" name="email" data-testid="mail" />;`,
      },
      { code: `const a = <a href="/healthz" rel="noopener">{t("x")}</a>;` },
      { code: `const a = <span>*</span>;` },
      { code: `const a = <span>  -  </span>;` },
      { code: `const a = <p>{t("a")} {t("b")}</p>;` },
      { code: `const a = <img src="/a.png" alt="" />;` },
      { code: `const a = <img alt={t("site.name")} />;` },
      { code: `const a = <button aria-label={t("x")} title={label} />;` },
    ],
    invalid: [
      {
        code: `const a = <p>Hola mundo</p>;`,
        errors: [{ messageId: "text", line: 1 }],
      },
      {
        code: `const a = (\n<p>\n  Texto\n</p>);`,
        errors: [{ messageId: "text", line: 3 }],
      },
      {
        code: `const a = <p>{"Hola"}</p>;`,
        errors: [{ messageId: "text" }],
      },
      {
        code: `const a = <img src="/a.png" alt="Logo" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <button aria-label="Cerrar" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <button title="Cerrar" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <input placeholder="Tu correo" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: "const a = <input placeholder={'Tu correo'} />;",
        errors: [{ messageId: "attribute" }],
      },
    ],
  });
});

describe("guardia de textos: dónde aplica la regla", () => {
  const SOURCE = `export const A = () => <p>Hola</p>;`;

  async function lintAt(filePath: string): Promise<number> {
    const { ESLint } = await import("eslint");
    const [result] = await new ESLint().lintText(SOURCE, { filePath });
    return (
      result?.messages.filter(
        (message) => message.ruleId === "volleytip/no-hardcoded-text",
      ).length ?? 0
    );
  }

  it("aplica a un componente de src", async () => {
    expect(await lintAt("src/components/ejemplo.tsx")).toBe(1);
  });

  it("no aplica a las rutas de /dev/", async () => {
    expect(await lintAt("src/routes/dev-ejemplo.tsx")).toBe(0);
  });

  it("no aplica a los archivos de prueba", async () => {
    expect(await lintAt("src/components/ejemplo.test.tsx")).toBe(0);
  });
});
