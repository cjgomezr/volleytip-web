import { redirect, UNSAFE_ErrorResponseImpl } from "react-router";
import { describe, expect, it } from "vitest";

import { PANEL_ADMIN_PAGES, PANEL_MEMBER_PAGES } from "~/lib/i18n/panel-pages";

import {
  isConnectionFailure,
  isUnsentSubmission,
  sendPanelForm,
  withoutUnsent,
} from "./unsent-submission";

const NETWORK_MESSAGES = [
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Load failed",
  "Failed to fetch dynamically imported module: /assets/a.js",
  "error loading dynamically imported module: /assets/a.js",
  "Importing a module script failed.",
];

describe("envío del panel que no llega", () => {
  it.each(NETWORK_MESSAGES)(
    "reconoce el fallo de red del navegador: %s",
    (message) => {
      expect(isConnectionFailure(new TypeError(message))).toBe(true);
    },
  );

  it.each([
    ["un error del servidor", new Error("Unexpected Server Error")],
    ["un TypeError de código", new TypeError("x is not a function")],
    ["algo que no es un error", "Failed to fetch"],
  ])("no confunde con la red %s", (_case, error) => {
    expect(isConnectionFailure(error)).toBe(false);
  });

  it("sin red responde que no se envió, con un estado que no recarga la pantalla", async () => {
    const result = await sendPanelForm(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );

    expect(result).toMatchObject({
      data: { status: "unsent" },
      init: { status: 503 },
    });
  });

  it.each([502, 503, 504])(
    "un %i del proxy cuenta como envío que no llegó",
    async (status) => {
      const proxyPage = new UNSAFE_ErrorResponseImpl(
        status,
        "Bad Gateway",
        "<html>Application failed to respond</html>",
      );

      await expect(
        sendPanelForm(() => Promise.reject(proxyPage)),
      ).resolves.toMatchObject({ data: { status: "unsent" } });
    },
  );

  it.each([
    ["un 503 que lanza la aplicación", 503, null],
    ["un 403 de la guardia", 403, "Forbidden"],
  ])("deja pasar %s", async (_case, status, body) => {
    const answer = new UNSAFE_ErrorResponseImpl(status, "", body);

    await expect(sendPanelForm(() => Promise.reject(answer))).rejects.toBe(
      answer,
    );
  });

  it("entrega tal cual la respuesta del servidor", async () => {
    const outcome = { status: "saved" } as const;

    await expect(sendPanelForm(() => Promise.resolve(outcome))).resolves.toBe(
      outcome,
    );
  });

  it.each([
    ["un fallo del servidor", new Error("Unexpected Server Error")],
    ["una redirección", redirect("/admin")],
  ])("deja pasar %s", async (_case, thrown) => {
    await expect(sendPanelForm(() => Promise.reject(thrown))).rejects.toBe(
      thrown,
    );
  });

  it("separa el aviso de lo que respondió el servidor", () => {
    const unsent = { status: "unsent" } as const;

    expect(isUnsentSubmission(unsent)).toBe(true);
    expect(isUnsentSubmission({ status: "saved" })).toBe(false);
    expect(withoutUnsent(unsent)).toBeUndefined();
    expect(withoutUnsent({ status: "saved" })).toEqual({ status: "saved" });
    expect(withoutUnsent(undefined)).toBeUndefined();
  });
});

const ROUTE_MODULES = import.meta.glob<Record<string, unknown>>(
  "../../routes/panel/*.{ts,tsx}",
);

describe("rutas del panel que reciben envíos", () => {
  it.each(
    [...PANEL_MEMBER_PAGES, ...PANEL_ADMIN_PAGES]
      // El comodín solo responde 404.
      .filter(({ id }) => id !== "adminMissing")
      .map(({ file }) => file),
  )("%s avisa cuando el envío no llega", async (file) => {
    const load = ROUTE_MODULES[`../../${file}`];
    if (load === undefined) throw new Error(`No se encontró ${file}`);

    const routeModule = await load();

    expect(typeof routeModule.clientAction).toBe(
      typeof routeModule.action === "function" ? "function" : "undefined",
    );
  });
});
