import type { Config } from "@react-router/dev/config";

export default {
  // El código de la app vive en src/, no en app/: las listas de rutas de la
  // fábrica (.github/visual-paths.txt, .github/text-only-paths.txt) y el Stop
  // gate ya cuentan con esa carpeta.
  appDirectory: "src",
  ssr: true,
} satisfies Config;
