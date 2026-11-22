import { readLocalSupabaseStatus } from "../../src/testing/local-supabase-status";

import { seedSiteFixtures } from "./site-fixtures";
import { visualBaselineNotice } from "./visual-baseline-notice";

export default async function globalSetup(): Promise<void> {
  const notice = visualBaselineNotice(process.platform);
  if (notice) {
    console.log(`\n${notice}\n`);
  }
  await seedSiteFixtures(readLocalSupabaseStatus());
}
