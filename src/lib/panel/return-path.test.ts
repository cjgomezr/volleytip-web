import { describe, expect, it } from "vitest";

import { buildSignInPath, resolveReturnPath } from "./return-path";

describe("guardia del panel: dirección de regreso", () => {
  it.each([
    "/admin",
    "/admin/mensajes",
    "/admin/mensajes?estado=new&pagina=2",
    "/en/admin",
    "/en/admin/messages",
  ])("conserva %s", (path) => {
    expect(resolveReturnPath(path, "es")).toBe(path);
  });

  it.each([
    ["nada", null],
    ["una dirección vacía", ""],
    ["otro sitio", "https://sitio-ajeno.test/admin"],
    ["otro sitio sin protocolo", "//sitio-ajeno.test/admin"],
    ["barras invertidas", "/\\sitio-ajeno.test/admin"],
    ["un salto de línea que parte las barras", "/\n/sitio-ajeno.test/admin"],
    ["un protocolo de script", "javascript:alert(1)"],
    ["una ruta relativa", "admin/mensajes"],
    ["una página pública", "/contacto"],
    ["un nombre que solo empieza igual", "/administracion"],
    ["una salida del panel con puntos", "/admin/../contacto"],
    ["puntos codificados", "/admin/%2e%2e/contacto"],
    ["la pantalla de entrada", "/admin/entrar"],
    ["la pantalla de entrada con barra", "/en/admin/sign-in/"],
    ["la salida", "/admin/salir"],
  ])("ignora %s y usa el inicio del panel", (_name, path) => {
    expect(resolveReturnPath(path, "es")).toBe("/admin");
    expect(resolveReturnPath(path, "en")).toBe("/en/admin");
  });

  it("devuelve la ruta ya normalizada, no el texto recibido", () => {
    expect(resolveReturnPath("/admin/a/../b", "es")).toBe("/admin/b");
  });
});

describe("guardia del panel: dirección de entrada", () => {
  it.each([
    ["/admin", "/admin/entrar?next=%2Fadmin"],
    ["/en/admin", "/en/admin/sign-in?next=%2Fen%2Fadmin"],
    [
      "/admin/mensajes?estado=new",
      "/admin/entrar?next=%2Fadmin%2Fmensajes%3Festado%3Dnew",
    ],
    ["/admin.data?_routes=adminHome.es", "/admin/entrar?next=%2Fadmin"],
    [
      "/en/admin/messages.data?page=2",
      "/en/admin/sign-in?next=%2Fen%2Fadmin%2Fmessages%3Fpage%3D2",
    ],
  ])("desde %s lleva a %s", (from, expected) => {
    const request = new Request(`http://localhost${from}`);

    expect(buildSignInPath(request)).toBe(expected);
  });

  it("no pide volver a la dirección de un envío", () => {
    const request = new Request("http://localhost/en/admin/sign-out", {
      method: "POST",
    });

    expect(buildSignInPath(request)).toBe("/en/admin/sign-in");
  });
});
