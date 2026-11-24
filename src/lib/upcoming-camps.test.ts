import { describe, expect, it } from "vitest";

import { hasUpcomingCamps } from "./upcoming-camps";

describe("hay camps próximos", () => {
  it("hoy responde que no", () => {
    expect(hasUpcomingCamps()).toBe(false);
  });
});
