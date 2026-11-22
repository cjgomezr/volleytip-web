import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestServerEnv } from "~/testing/test-server-env";

import { readSiteTexts } from "./site-texts.server";
import { createAnonSupabaseClient } from "./supabase/anon-client.server";
import type { TypedSupabaseClient } from "./supabase/typed-client";

const DATABASE_ERROR_STATUS = 500;

function createClientAnswering(response: Response): TypedSupabaseClient {
  vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(response));
  return createAnonSupabaseClient(buildTestServerEnv());
}

describe("textos editables: base caída", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propaga el error con la clave en el mensaje", async () => {
    const client = createClientAnswering(
      Response.json(
        { code: "XX000", message: "la base no responde" },
        { status: DATABASE_ERROR_STATUS },
      ),
    );

    await expect(readSiteTexts(["home.title"], "en", client)).rejects.toThrow(
      /home\.title.*la base no responde/,
    );
  });
});
