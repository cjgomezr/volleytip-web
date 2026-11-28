/**
 * La puerta a Bunny Stream: loaders y actions la abren con
 * `openBunnyStream(serverEnv)` y no crean el cliente por su cuenta.
 */

import { createFakeBunnyStream } from "~/testing/fake-bunny-stream.server";

import type { ServerEnv } from "../env.server";
import type { BunnyStream } from "./stream";
import { createBunnyStreamClient } from "./stream-client.server";

type BunnyStreamEnv = Pick<
  ServerEnv,
  "appEnv" | "bunnyStreamLibraryId" | "bunnyStreamApiKey" | "bunnyStreamCdnHost"
>;

// Uno por proceso, para que en las pruebas un video creado en un envío siga
// ahí en el siguiente.
let simulatedStream: BunnyStream | undefined;

/** En `test` entrega el Bunny simulado: ninguna prueba llama a Bunny. */
export function openBunnyStream(env: BunnyStreamEnv): BunnyStream {
  const settings = {
    libraryId: env.bunnyStreamLibraryId,
    apiKey: env.bunnyStreamApiKey,
    cdnHost: env.bunnyStreamCdnHost,
  };
  if (env.appEnv !== "test") {
    return createBunnyStreamClient(settings);
  }
  simulatedStream ??= createFakeBunnyStream(settings);
  return simulatedStream;
}
