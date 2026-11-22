import { describe, expect, it } from "vitest";

import { SOCIAL_NETWORKS } from "./social-links";

function hrefOf(id: string): string | undefined {
  return SOCIAL_NETWORKS.find((network) => network.id === id)?.href;
}

describe("direcciones de las redes", () => {
  it("declares the five networks of FR-003 in order", () => {
    expect(SOCIAL_NETWORKS.map(({ id }) => id)).toEqual([
      "tiktok",
      "instagram",
      "youtube",
      "facebook",
      "whatsapp",
    ]);
  });

  it("points each network to its official address", () => {
    expect(hrefOf("tiktok")).toBe("https://www.tiktok.com/@volleytip");
    expect(hrefOf("instagram")).toBe("https://www.instagram.com/volleytip/");
    expect(hrefOf("youtube")).toBe("https://www.youtube.com/@volleytip");
    expect(hrefOf("facebook")).toBe("https://www.facebook.com/volleytip/");
  });

  it("points WhatsApp to the number of FR-003", () => {
    expect(hrefOf("whatsapp")).toBe("https://wa.me/573146486275");
  });
});
