import { describe, expect, it } from "vitest";

import type { UploadSignature } from "./stream";
import { signUpload } from "./upload-signature.server";

const LIBRARY_ID = "133742";
const API_KEY = "llave-de-prueba-de-bunny";
const VIDEO_ID = "3f2b8c1e-9a4d-4e57-8b16-5c0d2a7e9f10";
const NOW = new Date("2026-12-01T09:13:20.000Z");
// NOW en segundos UNIX (1796116400) más una hora.
const EXPIRES_AT = 1_796_120_000;
// Calculado fuera del código:
// printf '%s' '133742llave-de-prueba-de-bunny1796120000<VIDEO_ID>' | sha256sum
const EXPECTED_SIGNATURE =
  "6f2032c088bf25f9cf7c5523cffa1fdde33878ad178a598ba6cff8655565d70d";

function sign(videoId: string = VIDEO_ID): UploadSignature {
  return signUpload({
    libraryId: LIBRARY_ID,
    apiKey: API_KEY,
    videoId,
    now: NOW,
  });
}

describe("bunny stream: firma de subida", () => {
  it("coincide con un valor calculado a mano", () => {
    expect(sign().signature).toBe(EXPECTED_SIGNATURE);
  });

  it("vence en una hora, en segundos UNIX", () => {
    expect(sign().expiresAt).toBe(EXPIRES_AT);
  });

  it("redondea hacia abajo los milisegundos del reloj", () => {
    const signature = signUpload({
      libraryId: LIBRARY_ID,
      apiKey: API_KEY,
      videoId: VIDEO_ID,
      now: new Date(NOW.getTime() + 999),
    });

    expect(signature.expiresAt).toBe(EXPIRES_AT);
  });

  it("devuelve solo la firma, el vencimiento, el video y la librería", () => {
    expect(sign()).toEqual({
      signature: EXPECTED_SIGNATURE,
      expiresAt: EXPIRES_AT,
      videoId: VIDEO_ID,
      libraryId: LIBRARY_ID,
    });
  });

  it("no incluye la llave de API en la respuesta", () => {
    expect(JSON.stringify(sign())).not.toContain(API_KEY);
  });

  // Las partes se concatenan sin separador: un id con cifras delante correría
  // el vencimiento y la firma valdría por mucho más de una hora.
  it.each(["", "9999" + VIDEO_ID, "no-es-un-id", `${VIDEO_ID}/..`])(
    "no firma un id de video con otra forma (%j)",
    (videoId) => {
      expect(() => sign(videoId)).toThrow(/id de video/i);
    },
  );
});
