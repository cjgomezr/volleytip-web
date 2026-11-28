import { describe, expect, it } from "vitest";

import { isFaqPath } from "./faq-path";

const ID = "11111111-1111-4111-8111-111111111111";

describe("direcciones de las preguntas frecuentes del panel", () => {
  it.each([
    "/admin/preguntas",
    "/admin/preguntas/",
    "/admin/preguntas/nueva",
    `/admin/preguntas/${ID}`,
    `/admin/preguntas/${ID}/publicar`,
    `/admin/preguntas/${ID}/retirar`,
    `/admin/preguntas/${ID}/mover`,
    "/en/admin/faqs",
    `/en/admin/faqs/${ID}/move`,
  ])("%s es de las preguntas", (pathname) => {
    expect(isFaqPath(pathname)).toBe(true);
  });

  it.each([
    "/admin",
    "/admin/mensajes",
    `/admin/mensajes/${ID}`,
    "/admin/preguntas-nuevas",
    "/preguntas-frecuentes",
    "/en/admin/site-texts",
  ])("%s no es de las preguntas", (pathname) => {
    expect(isFaqPath(pathname)).toBe(false);
  });
});
