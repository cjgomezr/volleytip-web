import type { Messages } from "../translate";
import type { tipsEs } from "./tips-es";

// Texts of the tips listing and the names of its fixed lists. The texts of
// each tip live in the database.
export const tipsEn = {
  "tips.fundamental.serve": "Serve",
  "tips.fundamental.reception": "Reception",
  "tips.fundamental.setting": "Setting",
  "tips.fundamental.attack": "Attack",
  "tips.fundamental.block": "Block",
  "tips.fundamental.defense": "Defense",
  "tips.level.basic": "Basic",
  "tips.level.intermediate": "Intermediate",
  "tips.level.advanced": "Advanced",
  "tips.title": "Volleyball tips · VolleyTip",
  "tips.description":
    "Short volleyball videos by skill and level: serve, reception, setting, attack, block and defense.",
  "tips.heading": "Tips",
  "tips.intro": {
    one: "{count} short video to improve your game. One idea per video.",
    other: "{count} short videos to improve your game. One idea per video.",
  },
  "tips.search.label": "Search",
  "tips.search.placeholder": "E.g. how to receive a float serve",
  "tips.search.submit": "Search tips",
  "tips.filters.label": "Filters",
  "tips.filters.fundamental": "Skill",
  "tips.filters.level": "Level",
  "tips.filters.all": "All",
  "tips.filters.allFundamentals": "All skills",
  "tips.filters.allLevels": "All levels",
  "tips.latest.badge": "Latest video",
  "tips.list.heading": "All tips",
  "tips.list.order": "Newest first",
  "tips.list.results": {
    one: "{count} result",
    other: "{count} results",
  },
  "tips.card.duration": "Length {duration}",
  "tips.loadMore": "Load more tips",
  "tips.loadMore.loading": "Loading tips",
  "tips.loadMore.failed": "We could not load more tips. Try again.",
  "tips.loadMore.loaded": {
    one: "{count} tip added.",
    other: "{count} tips added.",
  },
  "tips.noResults.text": "We found no tips with that search or those filters.",
  "tips.noResults.clear": "Clear filters",
  "tips.empty.text": "There are no published tips yet.",
  "tips.empty.follow": "Follow us on social media to see new videos.",
} as const satisfies Pick<Messages, keyof typeof tipsEs>;
