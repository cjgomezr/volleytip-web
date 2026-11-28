/**
 * La puerta a Bunny Stream: loaders y actions la abren con
 * `openBunnyStream(serverEnv...)` y no crean el cliente por su cuenta.
 */

import { createFakeBunnyStream } from "~/testing/fake-bunny-stream.server";

import type { AppEnvironment } from "../env.server";
import type { BunnyStream } from "./stream";
import {
  createBunnyStreamClient,
  type BunnyStreamSettings,
} from "./stream-client.server";

export interface OpenBunnyStreamSettings extends BunnyStreamSettings {
  readonly appEnv: AppEnvironment;
}

// Uno por proceso, para que en las pruebas un video creado en un envío siga
// ahí en el siguiente.
let simulatedStream: BunnyStream | undefined;

/** En `test` entrega el Bunny simulado: ninguna prueba llama a Bunny. */
export function openBunnyStream({
  appEnv,
  ...settings
}: OpenBunnyStreamSettings): BunnyStream {
  if (appEnv !== "test") {
    return createBunnyStreamClient(settings);
  }
  simulatedStream ??= createFakeBunnyStream(settings);
  return simulatedStream;
}
