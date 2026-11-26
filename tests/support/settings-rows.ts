import type { LocalSupabaseStatus } from "../../src/testing/local-supabase-status";

interface SettingRow {
  readonly key: string;
  readonly value: unknown;
}

function buildHeaders(status: LocalSupabaseStatus): Record<string, string> {
  return {
    apikey: status.SECRET_KEY,
    Authorization: `Bearer ${status.SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

async function request(
  status: LocalSupabaseStatus,
  query: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${status.API_URL}/rest/v1/settings?${query}`, {
    ...init,
    headers: { ...buildHeaders(status), ...init.headers },
  });
  if (!response.ok) {
    throw new Error(
      `No se pudo tocar la tabla settings (${response.status}): ${await response.text()}`,
    );
  }
  return response;
}

/** Quita esos ajustes de la base local. */
export async function removeSettingRows(
  status: LocalSupabaseStatus,
  keys: readonly string[],
): Promise<void> {
  await request(status, `key=in.(${keys.join(",")})`, { method: "DELETE" });
}

export async function readSettingRows(
  status: LocalSupabaseStatus,
  keys: readonly string[],
): Promise<readonly SettingRow[]> {
  const response = await request(
    status,
    `select=key,value&key=in.(${keys.join(",")})`,
  );
  return (await response.json()) as SettingRow[];
}

/** Deja esos ajustes como estaban: los que no tenían fila se quitan. */
export async function restoreSettingRows(
  status: LocalSupabaseStatus,
  keys: readonly string[],
  rows: readonly SettingRow[],
): Promise<void> {
  await removeSettingRows(status, keys);
  if (rows.length === 0) return;
  await request(status, "on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
}
