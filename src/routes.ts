import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("healthz", "routes/healthz.ts"),
  // Siempre al final: recibe lo que no coincidió con ninguna ruta.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
