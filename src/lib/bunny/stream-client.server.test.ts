import { describe, expect, it, vi, type Mock } from "vitest";

import type { BunnyErrorKind, BunnyStream } from "./stream";
import { createBunnyStreamClient } from "./stream-client.server";

const LIBRARY_ID = "133742";
const API_KEY = "llave-de-prueba-de-bunny";
const CDN_HOST = "videos-de-prueba.b-cdn.net";
const VIDEO_ID = "3f2b8c1e-9a4d-4e57-8b16-5c0d2a7e9f10";
const VIDEOS_URL = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`;

/** Un video como lo describe la documentación de Bunny, con campos de más. */
const BUNNY_VIDEO = {
  videoLibraryId: 133742,
  guid: VIDEO_ID,
  title: "Recepción con desplazamiento",
  length: 47,
  width: 1080,
  height: 1920,
  rotation: null,
  status: 4,
  thumbnailFileName: "thumbnail.jpg",
  views: 12,
};

const TRANSLATED_VIDEO = {
  id: VIDEO_ID,
  title: "Recepción con desplazamiento",
  durationSeconds: 47,
  orientation: "vertical",
  status: "ready",
  thumbnailUrl: `https://${CDN_HOST}/${VIDEO_ID}/thumbnail.jpg`,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function openClient(answer: () => Promise<Response>): {
  client: BunnyStream;
  fetchSpy: Mock<typeof fetch>;
} {
  const fetchSpy = vi.fn<typeof fetch>(answer);
  const client = createBunnyStreamClient({
    libraryId: LIBRARY_ID,
    apiKey: API_KEY,
    cdnHost: CDN_HOST,
    fetch: fetchSpy,
  });
  return { client, fetchSpy };
}

function answering(body: unknown, status = 200): ReturnType<typeof openClient> {
  return openClient(() => Promise.resolve(json(body, status)));
}

function readRequest(fetchSpy: Mock<typeof fetch>): Request {
  const [input, init] = fetchSpy.mock.calls[0] ?? [];
  return new Request(input as string, init);
}

const FIRST_PAGE = { page: 1, itemsPerPage: 20 };

describe("bunny stream: listar", () => {
  it("pide la página con la llave de la librería en AccessKey", async () => {
    const { client, fetchSpy } = answering({ totalItems: 0, items: [] });

    await client.listVideos({ page: 3, itemsPerPage: 50 });

    const request = readRequest(fetchSpy);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(`${VIDEOS_URL}?page=3&itemsPerPage=50`);
    expect(request.headers.get("AccessKey")).toBe(API_KEY);
  });

  it("traduce los campos de cada video y devuelve el total", async () => {
    const { client } = answering({ totalItems: 105, items: [BUNNY_VIDEO] });

    const result = await client.listVideos(FIRST_PAGE);

    expect(result).toEqual({
      ok: true,
      value: { totalItems: 105, videos: [TRANSLATED_VIDEO] },
    });
  });

  it("deja sin miniatura un video que no la tiene", async () => {
    const { client } = answering({
      totalItems: 1,
      items: [{ ...BUNNY_VIDEO, thumbnailFileName: null }],
    });

    const result = await client.listVideos(FIRST_PAGE);

    expect(result).toMatchObject({
      value: { videos: [{ thumbnailUrl: null }] },
    });
  });

  it("codifica el nombre de la miniatura en la dirección", async () => {
    const { client } = answering({
      totalItems: 1,
      items: [{ ...BUNNY_VIDEO, thumbnailFileName: "mi foto?.jpg" }],
    });

    const result = await client.listVideos(FIRST_PAGE);

    expect(result).toMatchObject({
      value: {
        videos: [
          {
            thumbnailUrl: `https://${CDN_HOST}/${VIDEO_ID}/mi%20foto%3F.jpg`,
          },
        ],
      },
    });
  });

  it.each([null, []])(
    "devuelve una página vacía cuando items es %j",
    async (items) => {
      const { client } = answering({ totalItems: 0, items });

      const result = await client.listVideos(FIRST_PAGE);

      expect(result).toEqual({
        ok: true,
        value: { totalItems: 0, videos: [] },
      });
    },
  );
});

describe("bunny stream: leer y crear", () => {
  it("lee un video por su id", async () => {
    const { client, fetchSpy } = answering(BUNNY_VIDEO);

    const result = await client.getVideo(VIDEO_ID);

    expect(result).toEqual({
      ok: true,
      value: { found: true, video: TRANSLATED_VIDEO },
    });
    expect(readRequest(fetchSpy).url).toBe(`${VIDEOS_URL}/${VIDEO_ID}`);
    expect(readRequest(fetchSpy).headers.get("AccessKey")).toBe(API_KEY);
  });

  it("dice que no existe cuando Bunny responde 404", async () => {
    const { client } = openClient(() =>
      Promise.resolve(new Response("", { status: 404 })),
    );

    const result = await client.getVideo(VIDEO_ID);

    expect(result).toEqual({ ok: true, value: { found: false } });
  });

  // `videos/..` se resolvería como otra dirección de la API.
  it.each(["..", "", "no-es-un-id", `${VIDEO_ID}/..`])(
    "dice que no existe un id con otra forma (%j) sin llamar a Bunny",
    async (videoId) => {
      const { client, fetchSpy } = answering(BUNNY_VIDEO);

      const result = await client.getVideo(videoId);

      expect(result).toEqual({ ok: true, value: { found: false } });
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("crea un video con su título y devuelve el id nuevo", async () => {
    const { client, fetchSpy } = answering(BUNNY_VIDEO);

    const result = await client.createVideo("Saque flotado");

    expect(result).toEqual({ ok: true, value: VIDEO_ID });
    const request = readRequest(fetchSpy);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(VIDEOS_URL);
    expect(request.headers.get("AccessKey")).toBe(API_KEY);
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(await request.json()).toEqual({ title: "Saque flotado" });
  });

  it("firma la subida con la llave y la librería del cliente", () => {
    const { client, fetchSpy } = answering({});

    const signature = client.signUpload(VIDEO_ID);

    expect(signature).toMatchObject({
      videoId: VIDEO_ID,
      libraryId: LIBRARY_ID,
    });
    expect(JSON.stringify(signature)).not.toContain(API_KEY);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

const OPERATIONS: ReadonlyArray<
  [string, (client: BunnyStream) => Promise<unknown>]
> = [
  ["listar", (client) => client.listVideos(FIRST_PAGE)],
  ["leer", (client) => client.getVideo(VIDEO_ID)],
  ["crear", (client) => client.createVideo("Saque flotado")],
];

function failureOf(kind: BunnyErrorKind): object {
  return { ok: false, error: { kind } };
}

describe.each(OPERATIONS)("bunny stream: errores al %s", (_name, run) => {
  it("con la red caída devuelve sin conexión", async () => {
    const { client } = openClient(() =>
      Promise.reject(new TypeError("fetch failed")),
    );

    await expect(run(client)).resolves.toMatchObject(failureOf("offline"));
  });

  it("si la respuesta se corta a la mitad devuelve sin conexión", async () => {
    const cut = new ReadableStream({
      start(controller) {
        controller.error(new TypeError("terminated"));
      },
    });
    const { client } = openClient(() => Promise.resolve(new Response(cut)));

    await expect(run(client)).resolves.toMatchObject(failureOf("offline"));
  });

  it.each([401, 403])("con un %i devuelve sin permiso", async (status) => {
    const { client } = answering({}, status);

    await expect(run(client)).resolves.toMatchObject(failureOf("unauthorized"));
  });

  it.each([400, 429, 500, 503])(
    "con un %i devuelve fallo de Bunny y dice el estado",
    async (status) => {
      const { client } = answering({}, status);

      const result = await run(client);

      expect(result).toMatchObject(failureOf("bunny_failure"));
      expect(JSON.stringify(result)).toContain(String(status));
    },
  );

  it.each(["<html>error</html>", "null", '{"inesperado":true}'])(
    "con una respuesta que no entiende (%s) devuelve fallo de Bunny",
    async (body) => {
      const { client } = openClient(() => Promise.resolve(new Response(body)));

      await expect(run(client)).resolves.toMatchObject(
        failureOf("bunny_failure"),
      );
    },
  );

  it("el detalle del error no lleva la llave", async () => {
    const { client } = openClient(() =>
      Promise.reject(new TypeError(`fetch failed ${API_KEY}`)),
    );

    expect(JSON.stringify(await run(client))).not.toContain(API_KEY);
  });
});

describe("bunny stream: errores propios de cada operación", () => {
  it.each(["listar", "crear"])(
    "un 404 al %s es fallo de Bunny: la librería no existe",
    async (name) => {
      const { client } = answering({}, 404);
      const run = OPERATIONS.find(([operation]) => operation === name)?.[1];

      await expect(run?.(client)).resolves.toMatchObject(
        failureOf("bunny_failure"),
      );
    },
  );

  it("un video sin id dentro de la lista es fallo de Bunny", async () => {
    const { client } = answering({
      totalItems: 1,
      items: [{ ...BUNNY_VIDEO, guid: "" }],
    });

    await expect(client.listVideos(FIRST_PAGE)).resolves.toMatchObject(
      failureOf("bunny_failure"),
    );
  });

  it("deja de esperar a un Bunny que no responde", async () => {
    const { client, fetchSpy } = answering({ totalItems: 0, items: [] });

    await client.listVideos(FIRST_PAGE);

    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
