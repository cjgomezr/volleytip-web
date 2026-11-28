/**
 * Traduce el video que describe la API de Bunny Stream al del sitio.
 *
 * Campos y estados según la documentación de Bunny, consultada el 28 de
 * noviembre de 2026:
 * https://bunny.net/docs/reference/video_getvideo
 * Miniatura: https://bunny.net/docs/stream/storage-structure.md
 */

import type { BunnyVideo, VideoOrientation, VideoStatus } from "./stream";

const FINISHED_STATUS = 4;
// 5 es `Error` y 6 es `UploadFailed`.
const FAILED_STATUSES: readonly number[] = [5, 6];
const HALF_TURN_DEGREES = 180;
const QUARTER_TURN_DEGREES = 90;

export interface VideoSize {
  readonly width?: unknown;
  readonly height?: unknown;
  readonly rotation?: unknown;
}

/** Un cuarto de vuelta hacia cualquier lado: 90, 270 o -90. */
function isQuarterTurned(rotation: unknown): boolean {
  return (
    typeof rotation === "number" &&
    Math.abs(rotation % HALF_TURN_DEGREES) === QUARTER_TURN_DEGREES
  );
}

export function readOrientation({
  width,
  height,
  rotation,
}: VideoSize): VideoOrientation {
  if (typeof width !== "number" || typeof height !== "number") {
    return "horizontal";
  }
  if (height > width) {
    return "vertical";
  }
  const isLandscape = width > height;
  return isLandscape && isQuarterTurned(rotation) ? "vertical" : "horizontal";
}

/** Lo que no sea terminado ni fallo, incluido un estado que Bunny agregue
 * después, cuenta como procesando. */
export function readStatus(bunnyStatus: number): VideoStatus {
  if (bunnyStatus === FINISHED_STATUS) {
    return "ready";
  }
  return FAILED_STATUSES.includes(bunnyStatus) ? "failed" : "processing";
}

function buildThumbnailUrl(
  cdnHost: string,
  videoId: string,
  fileName: unknown,
): string | null {
  if (typeof fileName !== "string" || fileName === "") {
    return null;
  }
  return `https://${cdnHost}/${encodeURIComponent(videoId)}/${encodeURIComponent(fileName)}`;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** El id (`guid`) de un video, o `null` si no trae uno. */
export function readVideoId(body: unknown): string | null {
  if (!isObject(body)) {
    return null;
  }
  const { guid } = body;
  return typeof guid === "string" && guid !== "" ? guid : null;
}

/** `null` si lo que llegó no es un video: sin id, título, duración o estado. */
export function readVideo(body: unknown, cdnHost: string): BunnyVideo | null {
  if (!isObject(body)) {
    return null;
  }
  const id = readVideoId(body);
  const { title, length, status } = body;
  if (
    id === null ||
    typeof title !== "string" ||
    typeof length !== "number" ||
    typeof status !== "number"
  ) {
    return null;
  }
  return {
    id,
    title,
    durationSeconds: length,
    orientation: readOrientation(body),
    status: readStatus(status),
    thumbnailUrl: buildThumbnailUrl(cdnHost, id, body.thumbnailFileName),
  };
}
