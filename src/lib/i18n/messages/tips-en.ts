import type { tipsEs } from "./tips-es";

// Names of the fixed lists of the tips. The texts of each tip live in the
// database.
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
} as const satisfies Record<keyof typeof tipsEs, string>;
