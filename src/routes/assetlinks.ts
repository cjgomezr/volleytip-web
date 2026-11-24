import { buildAssetLinks, readAppLinks } from "~/lib/app-links.server";

// `/.well-known/assetlinks.json`: Android lo pide para abrir `/r/` en la app.
// Sin versión por idioma ni cáscara, y sin redirigir.
export async function loader(): Promise<Response> {
  return Response.json(buildAssetLinks(await readAppLinks()));
}
