/**
 * Firma con la que el navegador sube un video directo a Bunny (protocolo TUS)
 * sin conocer la llave de API: SHA256 en hexadecimal de la librería, la llave,
 * el vencimiento en segundos UNIX y el id del video, sin separadores.
 *
 * Fuente, consultada el 28 de noviembre de 2026:
 * https://bunny.net/docs/stream/tus-resumable-uploads.md
 */

import { createHash } from "node:crypto";

import { isUuid } from "../is-uuid";
import type { UploadSignature } from "./stream";

/** Una hora. Es también el mínimo que recomienda Bunny. */
const UPLOAD_SIGNATURE_LIFETIME_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;

export interface UploadSignatureRequest {
  readonly libraryId: string;
  readonly apiKey: string;
  readonly videoId: string;
  readonly now: Date;
}

/**
 * Lanza si el id no tiene la forma de un id de video. Las partes se
 * concatenan sin separador: un id con cifras delante correría el vencimiento y
 * la firma serviría por mucho más de una hora.
 */
export function signUpload({
  libraryId,
  apiKey,
  videoId,
  now,
}: UploadSignatureRequest): UploadSignature {
  if (!isUuid(videoId)) {
    throw new Error("No se firma la subida: el id de video no es válido.");
  }
  const expiresAt =
    Math.floor(now.getTime() / MILLISECONDS_PER_SECOND) +
    UPLOAD_SIGNATURE_LIFETIME_SECONDS;
  const signature = createHash("sha256")
    .update(`${libraryId}${apiKey}${String(expiresAt)}${videoId}`)
    .digest("hex");
  return { signature, expiresAt, videoId, libraryId };
}
