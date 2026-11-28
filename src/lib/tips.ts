import type { Database } from "./database.types";
import type { MessageKey } from "./i18n/translate";

type Enums = Database["public"]["Enums"];

export type TipFundamental = Enums["tip_fundamental"];
export type TipLevel = Enums["tip_level"];
export type TipOrientation = Enums["tip_orientation"];

// Las mismas listas de la base y en su orden, que es el de la página. Se
// escriben aquí para que el navegador no cargue los tipos generados; una
// prueba exige que coincidan.
export const TIP_FUNDAMENTALS = [
  "serve",
  "reception",
  "setting",
  "attack",
  "block",
  "defense",
] as const satisfies readonly TipFundamental[];

export const TIP_LEVELS = [
  "basic",
  "intermediate",
  "advanced",
] as const satisfies readonly TipLevel[];

export const TIP_ORIENTATIONS = [
  "vertical",
  "horizontal",
] as const satisfies readonly TipOrientation[];

/** Lo que puede ofrecer el bloque de promoción de un tip (FR-014). La base lo
 * guarda como `{"type": ...}`. */
export const TIP_PROMOS = ["app", "social"] as const;

export type TipPromo = (typeof TIP_PROMOS)[number];

export const TIP_FUNDAMENTAL_NAME_KEYS = {
  serve: "tips.fundamental.serve",
  reception: "tips.fundamental.reception",
  setting: "tips.fundamental.setting",
  attack: "tips.fundamental.attack",
  block: "tips.fundamental.block",
  defense: "tips.fundamental.defense",
} as const satisfies Record<TipFundamental, MessageKey>;

export const TIP_LEVEL_NAME_KEYS = {
  basic: "tips.level.basic",
  intermediate: "tips.level.intermediate",
  advanced: "tips.level.advanced",
} as const satisfies Record<TipLevel, MessageKey>;
