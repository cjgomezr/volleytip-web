import { buildAppSiteAssociation, readAppLinks } from "~/lib/app-links.server";

// `/.well-known/apple-app-site-association`: iOS lo pide para abrir `/r/` en
// la app. Apple exige JSON sin extensión y sin redirecciones.
export async function loader(): Promise<Response> {
  return Response.json(buildAppSiteAssociation(await readAppLinks()));
}
