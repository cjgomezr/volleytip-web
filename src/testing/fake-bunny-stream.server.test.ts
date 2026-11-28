import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { openBunnyStream } from "~/lib/bunny/open-bunny-stream.server";
import type { BunnyStream, VideoPage } from "~/lib/bunny/stream";

import {
  createFakeBunnyStream,
  FAKE_BUNNY_VIDEOS,
} from "./fake-bunny-stream.server";

const SETTINGS = {
  libraryId: "133742",
  apiKey: "llave-de-prueba-de-bunny",
  cdnHost: "videos-de-prueba.b-cdn.net",
} as const;
const SERVER_VALUES = {
  bunnyStreamLibraryId: SETTINGS.libraryId,
  bunnyStreamApiKey: SETTINGS.apiKey,
  bunnyStreamCdnHost: SETTINGS.cdnHost,
} as const;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const EVERYTHING = { page: 1, itemsPerPage: 100 };

afterEach(() => {
  vi.unstubAllGlobals();
});

function forbidNetwork(): Mock<typeof fetch> {
  const fetchSpy = vi.fn<typeof fetch>(() =>
    Promise.reject(new Error("Una prueba llamó a la red")),
  );
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

async function listAll(bunny: BunnyStream): Promise<VideoPage> {
  const result = await bunny.listVideos(EVERYTHING);
  if (!result.ok) throw new Error(result.error.detail);
  return result.value;
}

async function addVideos(bunny: BunnyStream, count: number): Promise<void> {
  for (let added = 0; added < count; added += 1) {
    await bunny.createVideo("Relleno");
  }
}

describe("bunny stream: simulado", () => {
  it("trae ejemplos de las dos orientaciones y los tres estados", async () => {
    const { videos } = await listAll(createFakeBunnyStream(SETTINGS));

    expect(new Set(videos.map((video) => video.orientation))).toEqual(
      new Set(["vertical", "horizontal"]),
    );
    expect(new Set(videos.map((video) => video.status))).toEqual(
      new Set(["ready", "processing", "failed"]),
    );
  });

  it("pagina y devuelve el total", async () => {
    const bunny = createFakeBunnyStream(SETTINGS);
    await addVideos(bunny, 12 - FAKE_BUNNY_VIDEOS.length);
    const everything = (await listAll(bunny)).videos;

    const result = await bunny.listVideos({ page: 2, itemsPerPage: 10 });

    expect(result).toEqual({
      ok: true,
      value: { totalItems: 12, videos: everything.slice(10) },
    });
  });

  // Como Bunny: una pantalla probada aquí no puede contar con otro tamaño.
  it.each([
    [2, 10],
    [5000, 1000],
  ])("ajusta una página de %i videos a %i", async (requested, effective) => {
    const bunny = createFakeBunnyStream(SETTINGS);
    await addVideos(bunny, effective);

    const result = await bunny.listVideos({
      page: 1,
      itemsPerPage: requested,
    });

    expect(result.ok && result.value.videos).toHaveLength(effective);
  });

  it("lee un video de ejemplo y dice que no existe otro", async () => {
    const bunny = createFakeBunnyStream(SETTINGS);
    const [first] = (await listAll(bunny)).videos;

    expect(await bunny.getVideo(first?.id ?? "")).toEqual({
      ok: true,
      value: { found: true, video: first },
    });
    expect(await bunny.getVideo(UNKNOWN_ID)).toEqual({
      ok: true,
      value: { found: false },
    });
  });

  it("recuerda el video que crea, todavía procesando", async () => {
    const bunny = createFakeBunnyStream(SETTINGS);

    const created = await bunny.createVideo("Saque flotado");
    if (!created.ok) throw new Error(created.error.detail);

    expect(await bunny.getVideo(created.value)).toMatchObject({
      value: {
        found: true,
        video: { title: "Saque flotado", status: "processing" },
      },
    });
    expect((await listAll(bunny)).totalItems).toBe(
      FAKE_BUNNY_VIDEOS.length + 1,
    );
  });

  it("no comparte los videos creados entre dos simulados", async () => {
    await createFakeBunnyStream(SETTINGS).createVideo("Saque flotado");

    const { totalItems } = await listAll(createFakeBunnyStream(SETTINGS));

    expect(totalItems).toBe(FAKE_BUNNY_VIDEOS.length);
  });

  it("firma la subida igual que el cliente real, sin la llave", () => {
    const signature = createFakeBunnyStream(SETTINGS).signUpload(UNKNOWN_ID);

    expect(signature).toMatchObject({
      videoId: UNKNOWN_ID,
      libraryId: SETTINGS.libraryId,
    });
    expect(JSON.stringify(signature)).not.toContain(SETTINGS.apiKey);
  });

  it("no llama a la red en ninguna operación", async () => {
    const fetchSpy = forbidNetwork();
    const bunny = createFakeBunnyStream(SETTINGS);

    await bunny.listVideos(EVERYTHING);
    await bunny.getVideo(UNKNOWN_ID);
    await bunny.createVideo("Saque flotado");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("bunny stream: según el entorno", () => {
  it("en test entrega el simulado y nada sale a la red", async () => {
    const fetchSpy = forbidNetwork();
    const bunny = openBunnyStream({ ...SERVER_VALUES, appEnv: "test" });

    const { totalItems } = await listAll(bunny);

    expect(totalItems).toBeGreaterThanOrEqual(FAKE_BUNNY_VIDEOS.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("en test conserva entre llamadas el video que se creó", async () => {
    const env = { ...SERVER_VALUES, appEnv: "test" } as const;
    const created = await openBunnyStream(env).createVideo("Bloqueo");
    if (!created.ok) throw new Error(created.error.detail);

    expect(await openBunnyStream(env).getVideo(created.value)).toMatchObject({
      value: { found: true },
    });
  });

  it("en local llama a la librería que dicen las variables", async () => {
    const fetchSpy = forbidNetwork();

    await openBunnyStream({ ...SERVER_VALUES, appEnv: "local" }).listVideos(
      EVERYTHING,
    );

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toContain(`/library/${SETTINGS.libraryId}/videos`);
    expect(new Headers(init?.headers).get("AccessKey")).toBe(SETTINGS.apiKey);
  });

  it.each(["local", "staging", "production"] as const)(
    "en %s llama a Bunny",
    async (appEnv) => {
      const fetchSpy = forbidNetwork();

      const result = await openBunnyStream({
        ...SERVER_VALUES,
        appEnv,
      }).listVideos(EVERYTHING);

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ error: { kind: "offline" } });
    },
  );
});
