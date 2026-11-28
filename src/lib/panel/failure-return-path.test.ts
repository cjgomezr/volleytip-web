import { describe, expect, it } from "vitest";

import { getFailureReturnPath } from "./failure-return-path";

const ID = "0b7c1f9e-3f0a-4c1e-9a7d-2f4b6c8d0e12";

describe("a dónde vuelve la pantalla de fallo", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/textos", "/admin/textos"],
    ["/admin/textos/barra", "/admin/textos"],
    ["/admin/textos/cifras", "/admin/textos"],
    ["/admin/mercados/idioma", "/admin/mercados"],
    ["/admin/mercados/mercado", "/admin/mercados"],
    ["/admin/mercados/tasa", "/admin/mercados"],
    ["/admin/ajustes/mantenimiento", "/admin/ajustes"],
    [`/admin/mensajes/${ID}`, `/admin/mensajes/${ID}`],
    [`/admin/bitacora/${ID}`, `/admin/bitacora/${ID}`],
    [`/admin/preguntas/${ID}`, `/admin/preguntas/${ID}`],
    // Los botones de la lista de preguntas envían cada uno a su dirección.
    [`/admin/preguntas/${ID}/publicar`, "/admin/preguntas"],
    [`/admin/preguntas/${ID}/retirar`, "/admin/preguntas"],
    [`/admin/preguntas/${ID}/mover`, "/admin/preguntas"],
    [`/en/admin/faqs/${ID}/move`, "/en/admin/faqs"],
    // Los botones de la lista del equipo, y su confirmación, que es pantalla.
    [`/admin/equipo/${ID}/rol`, "/admin/equipo"],
    [`/admin/equipo/${ID}/activar`, "/admin/equipo"],
    [`/admin/equipo/${ID}/desactivar`, `/admin/equipo/${ID}/desactivar`],
    ["/admin/equipo/invitar", "/admin/equipo/invitar"],
    // El idioma y la salida no son pantallas: se vuelve al inicio.
    ["/admin/idioma", "/admin"],
    ["/admin/salir", "/admin"],
    ["/en/admin/site-texts/announcements", "/en/admin/site-texts"],
    ["/en/admin/sign-out", "/en/admin"],
    // La barra final no cambia la pantalla.
    ["/admin/textos/", "/admin/textos"],
  ])("desde %s vuelve a %s", (pathname, expected) => {
    expect(getFailureReturnPath({ pathname, search: "" })).toBe(expected);
  });

  it("conserva la búsqueda de la pantalla", () => {
    expect(
      getFailureReturnPath({ pathname: "/admin/bitacora", search: "?p=2" }),
    ).toBe("/admin/bitacora?p=2");
  });

  it.each([
    ["/admin/ajustes", "?saved=app", "/admin/ajustes"],
    ["/admin/bitacora", "?saved=x&p=2", "/admin/bitacora?p=2"],
    ["/admin/equipo", "?aviso=invited", "/admin/equipo"],
  ])(
    "desde %s%s no repite el aviso de un envío anterior",
    (pathname, search, expected) => {
      expect(getFailureReturnPath({ pathname, search })).toBe(expected);
    },
  );

  it("no lleva la búsqueda de un envío a otra pantalla", () => {
    expect(
      getFailureReturnPath({
        pathname: "/admin/textos/barra",
        search: "?index",
      }),
    ).toBe("/admin/textos");
  });
});
