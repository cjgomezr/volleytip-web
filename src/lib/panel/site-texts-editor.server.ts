import type { SiteTextsView } from "../admin/site-texts";
import {
  MAX_ANNOUNCEMENT_LENGTH,
  MAX_ANNOUNCEMENT_MESSAGES,
} from "../announcement-bar.server";
import {
  MAX_STAT_LABEL_LENGTH,
  MAX_STAT_VALUE_LENGTH,
  SITE_STAT_IDS,
} from "../site-stats.server";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import {
  describeStoredBar,
  readStoredBar,
} from "./announcement-bar-editor.server";
import { describeStat, readStoredStats } from "./site-stats-editor.server";

/** Lo que muestra "Textos del sitio", leído con el cliente de la sesión. */
export async function readSiteTextsEditor(
  client: TypedSupabaseClient,
): Promise<SiteTextsView> {
  const [bar, stats] = await Promise.all([
    readStoredBar(client),
    readStoredStats(client),
  ]);
  return {
    bar: describeStoredBar(bar),
    stats: SITE_STAT_IDS.map((id) => describeStat(id, stats)),
    limits: {
      maxMessages: MAX_ANNOUNCEMENT_MESSAGES,
      maxMessageLength: MAX_ANNOUNCEMENT_LENGTH,
      maxStatValueLength: MAX_STAT_VALUE_LENGTH,
      maxStatLabelLength: MAX_STAT_LABEL_LENGTH,
    },
  };
}
