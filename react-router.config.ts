import type { Config } from "@react-router/dev/config";

export default {
  // El código de la app vive en src/, no en app/: las listas de rutas de la
  // fábrica (.github/visual-paths.txt, .github/text-only-paths.txt) y el Stop
  // gate ya cuentan con esa carpeta.
  appDirectory: "src",
  ssr: true,
  // React Router rechaza un envío de formulario cuyo origen no coincide con
  // la dirección de la petición. Detrás del proxy del hosting nunca
  // coinciden: el proxy termina el HTTPS y el servidor ve la petición por
  // http, mientras el navegador manda su origen con https. Estos son los
  // dominios propios desde los que sí se acepta un envío. Van exactos, sin
  // comodines: un subdominio nuevo se agrega aquí a propósito.
  allowedActionOrigins: [
    "volleytip.com",
    "www.volleytip.com",
    "staging.volleytip.com",
  ],
} satisfies Config;
