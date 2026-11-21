import tseslint from "typescript-eslint";
import { ESLint, RuleTester } from "eslint";
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
      { code: 'const a = <p>{ok ? t("a") : null}</p>;' },
      { code: "const a = <p>{`${n}`}</p>;" },
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
      { code: `const a = <TextField label={t("x")} hint={hint} />;` },
      { code: `const a = <p>{n + 1}</p>;` },
      { code: `const a = <p>{t("a") + t("b")}</p>;` },
      { code: `const a = <input type="hidden" value="dev_sample" />;` },
      { code: `const a = <input type="submit" value={t("x")} />;` },
      { code: `const a = <option value="colombia">{t("x")}</option>;` },
      { code: `const NAV = [{ label: t("nav.shop"), to: "/tienda" }];` },
      { code: `const meta = () => [{ title: data.title }];` },
      {
        code: `const a = { variant: "primary", type: "text", name: "email" };`,
      },
      { code: `const a = { title: "" };` },
      { code: `interface Props { readonly label: string; title?: "a" | "b" }` },
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
      { code: "const a = <p>{`Hola`}</p>;", errors: [{ messageId: "text" }] },
      {
        code: `const a = <p>{ok ? "Hola" : "Adiós"}</p>;`,
        errors: [{ messageId: "text" }],
      },
      {
        code: `const a = <p>{ok && "Hola"}</p>;`,
        errors: [{ messageId: "text" }],
      },
      {
        code: "const a = <img alt={`Logo`} />;",
        errors: [{ messageId: "attribute" }],
      },
      // Los componentes propios reciben su texto por props: es por donde se
      // escribe un formulario entero sin pasar por las traducciones.
      {
        code: `const a = <TextField label="Nombre completo" />;`,
        errors: [{ messageId: "attribute", data: { name: "label" } }],
      },
      {
        code: `const a = <TextField label={t("x")} hint="Como en tu documento" />;`,
        errors: [{ messageId: "attribute", data: { name: "hint" } }],
      },
      {
        code: `const a = <Eyebrow text="Nuevo" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <Card heading="Camps" description="Entrena con nosotros" />;`,
        errors: [{ messageId: "attribute" }, { messageId: "attribute" }],
      },
      {
        code: `const a = <div aria-description="Lo que se lee en voz alta" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <div aria-valuetext="Tres de cinco" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <input type="submit" value="Enviar pedido" />;`,
        errors: [{ messageId: "attribute", data: { name: "value" } }],
      },
      {
        code: `const a = <input value="Enviar" type="button" />;`,
        errors: [{ messageId: "attribute" }],
      },
      {
        code: `const a = <p>{"Total: " + n}</p>;`,
        errors: [{ messageId: "text" }],
      },
      {
        code: `const a = <img alt={"Foto de " + name} />;`,
        errors: [{ messageId: "attribute" }],
      },
      // Las listas de configuración y `meta()` guardan texto visible en
      // objetos, no en etiquetas.
      {
        code: `const NAV = [{ label: "Tienda", to: "/tienda" }];`,
        errors: [{ messageId: "property", data: { name: "label" }, line: 1 }],
      },
      {
        code: `const meta = () => [{ title: "Tienda · VolleyTip" }];`,
        errors: [{ messageId: "property", data: { name: "title" } }],
      },
      {
        code: `const a = { "aria-label": "Cerrar" };`,
        errors: [{ messageId: "property" }],
      },
      {
        code: `const a = { description: ok ? "Abierto" : "Cerrado" };`,
        errors: [{ messageId: "property" }],
      },
    ],
  });
});

// Cargar la configuración (parser y plugin) tarda: con toda la suite en
// paralelo el límite por defecto de 5 s no alcanza.
const LINT_TIMEOUT_MS = 30_000;

describe(
  "guardia de textos: dónde aplica la regla",
  { timeout: LINT_TIMEOUT_MS },
  () => {
    const SOURCE = `export const A = () => <p>Hola</p>;`;

    const eslint = new ESLint();

    async function lintAt(filePath: string): Promise<number> {
      const [result] = await eslint.lintText(SOURCE, { filePath });
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
  },
);
