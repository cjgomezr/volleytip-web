/**
 * Cliente de la API de Bunny Stream. Es de servidor: la llave de la librería
 * no sale de aquí.
 *
 * Ninguna petición lanza: la que falla devuelve un `BunnyError`.
 *
 * Contrato según la documentación de Bunny, consultada el 28 de noviembre de
 * 2026:
 * https://bunny.net/docs/reference/video_list
 * https://bunny.net/docs/reference/video_createvideo
 */

import { isUuid } from "../is-uuid";
import type {
  BunnyErrorKind,
  BunnyResult,
  BunnyStream,
  BunnyVideo,
  VideoLookup,
  VideoPage,
  VideoPageRequest,
} from "./stream";
import { signUpload } from "./upload-signature.server";
import { isObject, readVideo, readVideoId } from "./video.server";

const API_ORIGIN = "https://video.bunnycdn.com";
const REQUEST_TIMEOUT_MS = 10_000;
const NOT_FOUND_STATUS = 404;
const UNAUTHORIZED_STATUSES: readonly number[] = [401, 403];

export interface BunnyStreamSettings {
  readonly libraryId: string;
  /** La llave de la librería, no la de la cuenta. */
  readonly apiKey: string;
  /** Dominio de la zona de la librería, sin protocolo ni ruta. */
  readonly cdnHost: string;
}

export interface BunnyStreamClientSettings extends BunnyStreamSettings {
  /** Se inyecta para probar sin red. Por defecto, el `fetch` global. */
  readonly fetch?: typeof fetch;
}

interface ApiRequest {
  /** Qué se está pidiendo, para el detalle de los errores. */
  readonly operation: string;
  /** Lo que sigue a `/library/{libraryId}/videos`. */
  readonly path: string;
  readonly title?: string;
}

type ApiAnswer =
  | { readonly ok: true; readonly body: unknown }
  | {
      readonly ok: false;
      readonly status: number | null;
      readonly detail: string;
    };

function readErrorKind(status: number | null): BunnyErrorKind {
  if (status === null) {
    return "offline";
  }
  return UNAUTHORIZED_STATUSES.includes(status)
    ? "unauthorized"
    : "bunny_failure";
}

function fail<Value>(
  answer: Extract<ApiAnswer, { ok: false }>,
): BunnyResult<Value> {
  const { status, detail } = answer;
  return { ok: false, error: { kind: readErrorKind(status), detail } };
}

function failUnreadable<Value>(operation: string): BunnyResult<Value> {
  return {
    ok: false,
    error: {
      kind: "bunny_failure",
      detail: `Bunny Stream respondió algo que no se entiende al ${operation}.`,
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Quien lee el cuerpo rechaza `undefined` como cualquier otra forma que
    // no esperaba, y lo reporta como fallo de Bunny.
    return undefined;
  }
}

async function callApi(
  settings: BunnyStreamClientSettings,
  { operation, path, title }: ApiRequest,
): Promise<ApiAnswer> {
  const { libraryId, apiKey, fetch: fetchImplementation = fetch } = settings;
  const isWrite = title !== undefined;
  try {
    const response = await fetchImplementation(
      `${API_ORIGIN}/library/${encodeURIComponent(libraryId)}/videos${path}`,
      {
        method: isWrite ? "POST" : "GET",
        headers: {
          AccessKey: apiKey,
          Accept: "application/json",
          ...(isWrite ? { "Content-Type": "application/json" } : {}),
        },
        body: isWrite ? JSON.stringify({ title }) : null,
        // Al seguir una redirección, `fetch` repetiría el encabezado
        // AccessKey en la dirección de destino.
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      // El cuerpo no se usa; soltarlo libera la conexión.
      await response.body?.cancel();
      const detail = `Bunny Stream respondió ${String(response.status)} al ${operation}.`;
      return { ok: false, status: response.status, detail };
    }
    return { ok: true, body: parseJson(await response.text()) };
  } catch (error) {
    // Solo el nombre del error: su mensaje podría repetir los encabezados.
    const cause = error instanceof Error ? error.name : "error desconocido";
    const detail = `No hubo respuesta de Bunny Stream al ${operation} (${cause}).`;
    return { ok: false, status: null, detail };
  }
}

function readVideoPage(body: unknown, cdnHost: string): VideoPage | null {
  if (!isObject(body) || typeof body.totalItems !== "number") {
    return null;
  }
  // La documentación admite `items` nulo.
  const items: unknown = body.items ?? [];
  if (!Array.isArray(items)) {
    return null;
  }
  const videos = items.map((item) => readVideo(item, cdnHost));
  if (!videos.every((video): video is BunnyVideo => video !== null)) {
    return null;
  }
  return { totalItems: body.totalItems, videos };
}

async function listVideos(
  settings: BunnyStreamClientSettings,
  { page, itemsPerPage }: VideoPageRequest,
): Promise<BunnyResult<VideoPage>> {
  const operation = "listar los videos";
  const query = new URLSearchParams({
    page: String(page),
    itemsPerPage: String(itemsPerPage),
  });
  const answer = await callApi(settings, {
    operation,
    path: `?${query.toString()}`,
  });
  if (!answer.ok) {
    return fail(answer);
  }
  const videoPage = readVideoPage(answer.body, settings.cdnHost);
  return videoPage === null
    ? failUnreadable(operation)
    : { ok: true, value: videoPage };
}

async function getVideo(
  settings: BunnyStreamClientSettings,
  videoId: string,
): Promise<BunnyResult<VideoLookup>> {
  // Con otra forma no hay video, y algo como `..` cambiaría la dirección que
  // se pide.
  if (!isUuid(videoId)) {
    return { ok: true, value: { found: false } };
  }
  const operation = "leer un video";
  const answer = await callApi(settings, { operation, path: `/${videoId}` });
  if (!answer.ok) {
    return answer.status === NOT_FOUND_STATUS
      ? { ok: true, value: { found: false } }
      : fail(answer);
  }
  const video = readVideo(answer.body, settings.cdnHost);
  return video === null
    ? failUnreadable(operation)
    : { ok: true, value: { found: true, video } };
}

async function createVideo(
  settings: BunnyStreamClientSettings,
  title: string,
): Promise<BunnyResult<string>> {
  const operation = "crear un video";
  const answer = await callApi(settings, { operation, path: "", title });
  if (!answer.ok) {
    return fail(answer);
  }
  // Solo se exige el id: el video ya quedó creado, y darlo por fallido
  // dejaría uno huérfano en cada reintento.
  const videoId = readVideoId(answer.body);
  return videoId === null
    ? failUnreadable(operation)
    : { ok: true, value: videoId };
}

export function createBunnyStreamClient(
  settings: BunnyStreamClientSettings,
): BunnyStream {
  const { libraryId, apiKey } = settings;
  return {
    listVideos: (request) => listVideos(settings, request),
    getVideo: (videoId) => getVideo(settings, videoId),
    createVideo: (title) => createVideo(settings, title),
    signUpload: (videoId) =>
      signUpload({ libraryId, apiKey, videoId, now: new Date() }),
  };
}
