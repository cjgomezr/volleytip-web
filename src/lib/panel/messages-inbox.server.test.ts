import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { InboxQuery } from "~/lib/admin/messages";
import type { Database } from "~/lib/database.types";
import type { TypedSupabaseClient } from "~/lib/supabase/typed-client";

import { readInbox, type InboxPage } from "./messages-inbox.server";

const NO_FILTERS: InboxQuery = {
  reason: null,
  status: null,
  search: "",
  page: 1,
};

interface Capture {
  readonly client: TypedSupabaseClient;
  readonly urls: URL[];
}

/** Una API que dice cuántos hay y no devuelve filas: lo que importa aquí es
 * qué se le pide. */
function captureRequests(total: number, status = 200): Capture {
  const urls: URL[] = [];
  const client = createClient<Database>("http://supabase.test", "llave", {
    global: {
      fetch: (input, init) => {
        const request = new Request(input, init);
        urls.push(new URL(request.url));
        const headers = { "Content-Range": `*/${total}` };
        return Promise.resolve(
          request.method === "HEAD"
            ? new Response(null, { status, headers })
            : Response.json([], { status }),
        );
      },
    },
  });
  return { client, urls };
}

async function read(
  query: Partial<InboxQuery>,
  total = 200,
): Promise<{ count: URL; list: URL; page: InboxPage }> {
  const { client, urls } = captureRequests(total);
  const page = await readInbox(client, { ...NO_FILTERS, ...query });
  const [count, list] = urls;
  if (count === undefined || list === undefined) {
    throw new Error("Se esperaban el conteo y la lista");
  }
  return { count, list, page };
}

describe("bandeja: lista", () => {
  it("pide del más reciente al más antiguo, con el id para desempatar", async () => {
    const { list } = await read({});

    expect(list.searchParams.get("order")).toBe("created_at.desc,id.desc");
  });

  it("pide de 50 en 50 según la página", async () => {
    const { list, page } = await read({ page: 3 });

    expect(list.searchParams.get("offset")).toBe("100");
    expect(list.searchParams.get("limit")).toBe("50");
    expect(page).toMatchObject({ page: 3, pageCount: 4, total: 200 });
  });

  it("una página más allá del final es la última", async () => {
    const { list, page } = await read({ page: 40 }, 120);

    expect(list.searchParams.get("offset")).toBe("100");
    expect(page).toMatchObject({ page: 3, pageCount: 3 });
  });

  it("sin mensajes no pide filas", async () => {
    const { client, urls } = captureRequests(0);

    const page = await readInbox(client, { ...NO_FILTERS, page: 5 });

    expect(urls).toHaveLength(1);
    expect(page).toEqual({ rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("si la base falla, lanza en vez de mostrar la bandeja vacía", async () => {
    const { client } = captureRequests(0, 500);

    await expect(readInbox(client, NO_FILTERS)).rejects.toThrow(/mensajes/);
  });
});

describe("bandeja: filtros", () => {
  it("combina motivo, estado y búsqueda en el conteo y en la lista", async () => {
    const { count, list } = await read({
      reason: "order",
      status: "new",
      search: "laura",
    });

    for (const url of [count, list]) {
      expect(url.searchParams.get("reason")).toBe("eq.order");
      expect(url.searchParams.get("status")).toBe("eq.new");
      expect(url.searchParams.get("or")).toBe(
        '(name.ilike."%laura%",email.ilike."%laura%")',
      );
    }
  });

  it("sin filtros no manda ninguno", async () => {
    const { list } = await read({});

    expect([...list.searchParams.keys()].sort()).toEqual([
      "limit",
      "offset",
      "order",
      "select",
    ]);
  });

  it.each([
    ["50%", String.raw`"%50\\%%"`],
    ["a_b", String.raw`"%a\\_b%"`],
    ['di "hola"', String.raw`"%di \"hola\"%"`],
    ["a),status.eq.new", '"%a),status.eq.new%"'],
    ["a*b", '"%a_b%"'],
  ])("busca %s como texto, sin comodines ni filtros", async (search, value) => {
    const { list } = await read({ search });

    expect(list.searchParams.get("or")).toBe(
      `(name.ilike.${value},email.ilike.${value})`,
    );
  });
});
