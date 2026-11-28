import { describe, expect, it } from "vitest";

import { Constants } from "./database.types";
import { SUPPORTED_LANGUAGES } from "./i18n/languages";
import { getTranslate } from "./i18n/messages.server";
import {
  TIP_FUNDAMENTAL_NAME_KEYS,
  TIP_FUNDAMENTALS,
  TIP_LEVEL_NAME_KEYS,
  TIP_LEVELS,
  TIP_ORIENTATIONS,
} from "./tips";

// `database.types.ts` se genera desde la base y el CI falla si queda viejo.
const { Enums } = Constants.public;

describe("tips: fundamentos y niveles", () => {
  it("las listas del código coinciden con las de la base", () => {
    expect(TIP_FUNDAMENTALS).toEqual(Enums.tip_fundamental);
    expect(TIP_LEVELS).toEqual(Enums.tip_level);
    expect(TIP_ORIENTATIONS).toEqual(Enums.tip_orientation);
  });

  it("cada fundamento tiene su nombre en español y en inglés", () => {
    const names = SUPPORTED_LANGUAGES.map(({ code }) =>
      TIP_FUNDAMENTALS.map((value) =>
        getTranslate(code)(TIP_FUNDAMENTAL_NAME_KEYS[value]),
      ),
    );

    expect(names).toEqual([
      ["Saque", "Recepción", "Colocación", "Ataque", "Bloqueo", "Defensa"],
      ["Serve", "Reception", "Setting", "Attack", "Block", "Defense"],
    ]);
  });

  it("cada nivel tiene su nombre en español y en inglés", () => {
    const names = SUPPORTED_LANGUAGES.map(({ code }) =>
      TIP_LEVELS.map((value) => getTranslate(code)(TIP_LEVEL_NAME_KEYS[value])),
    );

    expect(names).toEqual([
      ["Básico", "Intermedio", "Avanzado"],
      ["Basic", "Intermediate", "Advanced"],
    ]);
  });
});
