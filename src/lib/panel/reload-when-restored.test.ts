import { describe, expect, it, vi } from "vitest";

import { reloadWhenRestored } from "./reload-when-restored";

function showPage(target: EventTarget, persisted: boolean): void {
  target.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));
}

describe("google: volver atrás", () => {
  it("recarga la página que el navegador restaura de su memoria", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    reloadWhenRestored(target, reload);

    showPage(target, true);

    expect(reload).toHaveBeenCalledOnce();
  });

  it("no recarga una página que carga de nuevo", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    reloadWhenRestored(target, reload);

    showPage(target, false);

    expect(reload).not.toHaveBeenCalled();
  });

  it("deja de escuchar al limpiar", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const stop = reloadWhenRestored(target, reload);

    stop();
    showPage(target, true);

    expect(reload).not.toHaveBeenCalled();
  });
});
