import { readLocalSupabaseStatusOnce } from "./local-supabase-status-once";
import { seedSiteFixtures } from "./site-fixtures";
import { visualBaselineNotice } from "./visual-baseline-notice";

export default async function globalSetup(): Promise<void> {
  const notice = visualBaselineNotice(process.platform);
  if (notice) {
    console.log(`\n${notice}\n`);
  }
  await seedSiteFixtures(readLocalSupabaseStatusOnce());
}
