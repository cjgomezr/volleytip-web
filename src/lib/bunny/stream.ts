/**
 * Lo que el sitio sabe de Bunny Stream. El cliente real
 * (`stream-client.server.ts`) y el simulado de las pruebas
 * (`~/testing/fake-bunny-stream.server`) cumplen `BunnyStream`. Aquí solo hay
 * tipos, así que una pantalla puede importarlos.
 */

export type VideoOrientation = "vertical" | "horizontal";

export type VideoStatus = "ready" | "processing" | "failed";

export interface BunnyVideo {
  readonly id: string;
  readonly title: string;
  readonly durationSeconds: number;
  readonly orientation: VideoOrientation;
  readonly status: VideoStatus;
  /** `null` mientras Bunny no tenga una. */
  readonly thumbnailUrl: string | null;
}

export interface VideoPageRequest {
  /** Empieza en 1. */
  readonly page: number;
  /** Bunny lo ajusta al rango de 10 a 1000. */
  readonly itemsPerPage: number;
}

export interface VideoPage {
  /** Cuántos videos hay en la librería, sumando todas las páginas. */
  readonly totalItems: number;
  readonly videos: readonly BunnyVideo[];
}

export type VideoLookup =
  | { readonly found: true; readonly video: BunnyVideo }
  | { readonly found: false };

/** Sin conexión, sin permiso (la llave no sirve) o fallo del lado de Bunny. */
export type BunnyErrorKind = "offline" | "unauthorized" | "bunny_failure";

export interface BunnyError {
  readonly kind: BunnyErrorKind;
  /** Para el registro del servidor: qué se pedía y qué pasó. No se le muestra
   * a la persona y nunca lleva la llave. */
  readonly detail: string;
}

export type BunnyResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: BunnyError };

/** Lo que necesita el navegador para subir un video directo a Bunny. */
export interface UploadSignature {
  readonly signature: string;
  /** Segundos UNIX. */
  readonly expiresAt: number;
  readonly videoId: string;
  readonly libraryId: string;
}

export interface BunnyStream {
  listVideos(request: VideoPageRequest): Promise<BunnyResult<VideoPage>>;
  getVideo(videoId: string): Promise<BunnyResult<VideoLookup>>;
  /** Devuelve el id del video nuevo, que todavía no tiene archivo. */
  createVideo(title: string): Promise<BunnyResult<string>>;
  /** Lanza si `videoId` no tiene la forma de un id de video. */
  signUpload(videoId: string): UploadSignature;
}
