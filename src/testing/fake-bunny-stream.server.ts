import { randomUUID } from "node:crypto";

import type { BunnyStream, BunnyVideo } from "~/lib/bunny/stream";
import type { BunnyStreamSettings } from "~/lib/bunny/stream-client.server";
import { signUpload } from "~/lib/bunny/upload-signature.server";

/**
 * Un Bunny Stream de mentira, en memoria, con videos de ejemplo. Es el que usa
 * el servidor con `APP_ENV=test` (`openBunnyStream`): no toca la red.
 */

type SampleVideo = Omit<BunnyVideo, "thumbnailUrl">;

export const FAKE_BUNNY_VIDEOS: readonly SampleVideo[] = [
  {
    id: "1a6f0c52-8d3e-4b7a-9c11-2f5e8a4d6b01",
    title: "Recepción con desplazamiento",
    durationSeconds: 47,
    orientation: "vertical",
    status: "ready",
  },
  {
    id: "2b7a1d63-9e4f-4c8b-8d22-3a6f9b5e7c02",
    title: "Saque flotado",
    durationSeconds: 62,
    orientation: "vertical",
    status: "ready",
  },
  {
    id: "3c8b2e74-af50-4d9c-9e33-4b7a0c6f8d03",
    title: "Lectura del bloqueo",
    durationSeconds: 128,
    orientation: "horizontal",
    status: "ready",
  },
  {
    id: "4d9c3f85-b061-4ead-af44-5c8b1d709e04",
    title: "Colocación en suspensión",
    durationSeconds: 0,
    orientation: "vertical",
    status: "processing",
  },
  {
    id: "5ead4096-c172-4fbe-b055-6d9c2e81af05",
    title: "Defensa en plancha",
    durationSeconds: 0,
    orientation: "horizontal",
    status: "failed",
  },
];

// El rango al que Bunny ajusta `itemsPerPage`.
const MIN_ITEMS_PER_PAGE = 10;
const MAX_ITEMS_PER_PAGE = 1000;

function clampItemsPerPage(itemsPerPage: number): number {
  return Math.min(
    Math.max(itemsPerPage, MIN_ITEMS_PER_PAGE),
    MAX_ITEMS_PER_PAGE,
  );
}

function withThumbnail(video: SampleVideo, cdnHost: string): BunnyVideo {
  const thumbnailUrl = `https://${cdnHost}/${video.id}/thumbnail.jpg`;
  return { ...video, thumbnailUrl };
}

/** Recién creado, como en Bunny: sin archivo, sin duración y sin miniatura. */
function createEmptyVideo(title: string): BunnyVideo {
  return {
    id: randomUUID(),
    title,
    durationSeconds: 0,
    orientation: "horizontal",
    status: "processing",
    thumbnailUrl: null,
  };
}

export function createFakeBunnyStream({
  libraryId,
  apiKey,
  cdnHost,
}: BunnyStreamSettings): BunnyStream {
  let videos: readonly BunnyVideo[] = FAKE_BUNNY_VIDEOS.map((video) =>
    withThumbnail(video, cdnHost),
  );
  return {
    listVideos({ page, itemsPerPage }) {
      const pageSize = clampItemsPerPage(itemsPerPage);
      const start = (page - 1) * pageSize;
      const value = {
        totalItems: videos.length,
        videos: videos.slice(start, start + pageSize),
      };
      return Promise.resolve({ ok: true, value });
    },
    getVideo(videoId) {
      const video = videos.find((candidate) => candidate.id === videoId);
      const value =
        video === undefined
          ? ({ found: false } as const)
          : ({ found: true, video } as const);
      return Promise.resolve({ ok: true, value });
    },
    createVideo(title) {
      const video = createEmptyVideo(title);
      videos = [...videos, video];
      return Promise.resolve({ ok: true, value: video.id });
    },
    signUpload: (videoId) =>
      signUpload({ libraryId, apiKey, videoId, now: new Date() }),
  };
}
