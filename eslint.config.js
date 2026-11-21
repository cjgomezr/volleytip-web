import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import { volleytipPlugin } from "./eslint-rules/index.ts";

export default tseslint.config(
  {
    // La fábrica deja un checkout completo por ticket en .claude/worktrees/ y
    // su estado en .factory/. Sin esta exclusión, `eslint .` recorre el repo
    // tantas veces como worktrees haya.
    ignores: [
      ".claude/worktrees/**",
      ".factory/**",
      ".react-router/**",
      "build/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "docs/mockups/source/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Los archivos del kit de la fábrica llegan de la plantilla y no se
    // reescriben aquí: se actualizan desde ella. Se les perdonan solo las dos
    // reglas que traen incumplidas, para que el resto del lint siga contando.
    files: [
      "scripts/ui-review/**",
      "scripts/capture-ui.ts",
      "tests/unit/hooks/**",
      "tests/unit/scripts/**",
      "tests/unit/workflows/**",
      "tests/support/**",
    ],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true },
      ],
    },
  },
  {
    // Guardia de textos (AC-002). La página de muestra de /dev/ y las pruebas
    // llevan datos de prueba escritos a mano a propósito.
    files: ["src/**/*.tsx"],
    ignores: ["src/routes/dev-*", "src/**/*.test.tsx"],
    plugins: { volleytip: volleytipPlugin },
    rules: { "volleytip/no-hardcoded-text": "error" },
  },
);
