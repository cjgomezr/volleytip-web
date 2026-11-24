import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/app-links.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/app-links.server")>()),
  readAppLinks: vi.fn(),
}));
const { readAppLinks } = await import("~/lib/app-links.server");
const readAppLinksMock = vi.mocked(readAppLinks);

const { loader: assetLinksLoader } = await import("./assetlinks");
const { loader: associationLoader } =
  await import("./apple-app-site-association");

afterEach(() => {
  readAppLinksMock.mockReset();
});

describe("assetlinks.json", () => {
  it("sin ajuste responde 200, JSON y el cuerpo []", async () => {
    readAppLinksMock.mockResolvedValue({});

    const response = await assetLinksLoader();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual([]);
  });

  it("con el ajuste devuelve los datos de Android", async () => {
    readAppLinksMock.mockResolvedValue({
      android: { packageName: "com.vt", sha256CertFingerprints: ["AA"] },
    });

    const body: unknown = await (await assetLinksLoader()).json();

    expect(body).toEqual([
      expect.objectContaining({
        target: expect.objectContaining({ package_name: "com.vt" }),
      }),
    ]);
  });

  it("no redirige", async () => {
    readAppLinksMock.mockResolvedValue({});

    const response = await assetLinksLoader();

    expect(response.headers.get("Location")).toBeNull();
  });
});

describe("apple-app-site-association", () => {
  it("sin ajuste responde 200, JSON y el cuerpo vacío de Apple", async () => {
    readAppLinksMock.mockResolvedValue({});

    const response = await associationLoader();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ applinks: { details: [] } });
  });

  it("con el ajuste devuelve los datos de iOS", async () => {
    readAppLinksMock.mockResolvedValue({ ios: { appIds: ["T.com.vt"] } });

    const body: unknown = await (await associationLoader()).json();

    expect(JSON.stringify(body)).toContain("T.com.vt");
  });

  it("no redirige", async () => {
    readAppLinksMock.mockResolvedValue({});

    const response = await associationLoader();

    expect(response.headers.get("Location")).toBeNull();
  });
});
