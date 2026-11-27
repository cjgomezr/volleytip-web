import type { LocalSupabaseStatus } from "../../src/testing/local-supabase-status";

async function patch(
  status: LocalSupabaseStatus,
  query: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${status.API_URL}/rest/v1/${query}`, {
    method: "PATCH",
    headers: {
      apikey: status.SECRET_KEY,
      Authorization: `Bearer ${status.SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `No se pudo restaurar ${query} (${response.status}): ${await response.text()}`,
    );
  }
}

/** Deja el idioma inglés y el mercado de Colombia como las migraciones. */
export async function restoreSeededMarkets(
  status: LocalSupabaseStatus,
): Promise<void> {
  await patch(status, "languages?code=eq.en", { is_active: true });
  await patch(status, "markets?country_code=eq.CO", {
    is_active: true,
    ships_physical: true,
    default_locale: "es",
    payment_methods: [],
  });
}
