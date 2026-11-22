import { readLocalSupabaseStatusOnce } from "./local-supabase-status-once";
import { removeSiteFixtures } from "./site-fixtures";

export default async function globalTeardown(): Promise<void> {
  await removeSiteFixtures(readLocalSupabaseStatusOnce());
}
