import { defineConfig } from "vitest/config";

/**
 * El runner de los tests DEL KIT, no los de tu app.
 *
 * Los tests del kit vigilan las piezas de la fábrica que son iguales en todos
 * los proyectos: el Stop gate, los scripts de la cola de issues, los
 * workflows. Esos no dependen del stack que elijas, así que tienen su propio
 * runner y su propio comando (`npm run test:kit`), separado del `npm test` de
 * tu aplicación, que sigue siendo tuyo y lo rellena el bootstrap.
 *
 * Por qué Vitest y no el runner de cada proyecto: ver la sección "Los tests
 * del kit" del README. En resumen, la alternativa era escribirlos de forma
 * portable o traducirlos en el bootstrap, y eso falla dentro del proyecto de
 * otra persona.
 */
export default defineConfig({
  test: {
    // Los 5 s por defecto de Vitest están pensados para tests en memoria, y
    // estos no lo son: lanzan bash, git y binarios falsos de verdad. Bajo
    // carga agotan el plazo sin estar rotos.
    testTimeout: 20_000,
    // Sólo el kit. Los tests de tu app los recoge tu propio runner, y
    // *.spec.ts es de Playwright: mantener la separación por extensión y por
    // carpeta evita que cada runner coleccione la suite del otro.
    include: [
      "tests/unit/hooks/**/*.test.ts",
      "tests/unit/scripts/**/*.test.ts",
      "tests/unit/workflows/**/*.test.ts",
    ],
  },
});
