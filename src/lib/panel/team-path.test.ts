import { describe, expect, it } from "vitest";

import { isTeamPath } from "./team-path";

const ID = "11111111-1111-4111-8111-111111111111";

describe("direcciones del equipo del panel", () => {
  it.each([
    "/admin/equipo",
    "/admin/equipo/invitar",
    `/admin/equipo/${ID}/rol`,
    `/admin/equipo/${ID}/desactivar`,
    `/admin/equipo/${ID}/activar`,
    "/en/admin/team",
    `/en/admin/team/${ID}/deactivate`,
  ])("%s es del equipo", (pathname) => {
    expect(isTeamPath(pathname)).toBe(true);
  });

  it.each(["/admin", "/admin/preguntas", "/admin/equipos", "/nosotros"])(
    "%s no es del equipo",
    (pathname) => {
      expect(isTeamPath(pathname)).toBe(false);
    },
  );
});
