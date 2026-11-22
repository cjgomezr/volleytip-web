import { afterEach, describe, expect, it, vi } from "vitest";

import { isPlainLeftClick, saveLanguageChoice } from "./save-language-choice";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guardar la elección desde el selector", () => {
  it("envía el idioma y la página actual a la acción de idioma", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);

    await saveLanguageChoice("en", "/?a=1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/idioma");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe("language=en&from=%2F%3Fa%3D1");
  });

  it("no lanza si la petición falla: el cambio de página sigue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));

    await expect(saveLanguageChoice("en", "/")).resolves.toBeUndefined();
  });
});

describe("clic simple", () => {
  const plain = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };

  it("acepta el clic izquierdo sin teclas", () => {
    expect(isPlainLeftClick(plain)).toBe(true);
  });

  it("rechaza clic con tecla, botón del medio o ya cancelado", () => {
    expect(isPlainLeftClick({ ...plain, ctrlKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...plain, metaKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...plain, button: 1 })).toBe(false);
    expect(isPlainLeftClick({ ...plain, defaultPrevented: true })).toBe(false);
  });
});
