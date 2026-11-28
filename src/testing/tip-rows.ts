import { randomUUID } from "node:crypto";

import type { Database as GeneratedDatabase } from "~/lib/database.types";
import type { Language } from "~/lib/i18n/languages";

import { takeOnlyRow, type Database } from "./database";

type Enums = GeneratedDatabase["public"]["Enums"];

export interface TipTextSeed {
  readonly title: string;
  readonly achievement?: string | null;
  readonly keys?: readonly string[];
  readonly commonError?: string | null;
  readonly practice?: string | null;
}

/** Lo que una prueba puede fijar de un tip. Lo demás sale de un tip publicado
 * ayer, que cumple todas las reglas de la base. */
export interface TipSeed {
  readonly status?: Enums["publish_status"];
  readonly publishedAt?: Date | null;
  readonly fundamental?: Enums["tip_fundamental"] | null;
  readonly level?: Enums["tip_level"] | null;
  readonly isFeatured?: boolean;
  readonly bunnyVideoId?: string | null;
  readonly translations?: Partial<Record<Language, TipTextSeed>>;
}

export interface SeededTip {
  readonly id: string;
  readonly slug: string;
  readonly bunnyVideoId: string | null;
}

export interface TipRows {
  readonly insert: (seed?: TipSeed) => Promise<SeededTip>;
  /** Nadie borra tips por la API: la limpieza va por la conexión directa. */
  readonly removeAll: () => Promise<void>;
}

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * ONE_DAY_IN_MS);
}

async function insertText(
  database: Database,
  tipId: string,
  [locale, text]: readonly [string, TipTextSeed],
): Promise<void> {
  await database`
    insert into public.tip_translations (
      tip_id, locale, title, achievement, keys, common_error, practice
    ) values (
      ${tipId}, ${locale}, ${text.title}, ${text.achievement ?? null},
      ${[...(text.keys ?? [])]}::text[],
      ${text.commonError ?? null}, ${text.practice ?? null}
    )
  `;
}

/**
 * Los tips de un archivo de pruebas. El prefijo del `slug` los separa de los
 * de otros archivos, que corren en paralelo contra la misma base, y permite
 * borrar solo los propios.
 */
export function createTipRows(database: Database, slugPrefix: string): TipRows {
  async function insert(seed: TipSeed = {}): Promise<SeededTip> {
    const {
      status = "published",
      publishedAt = daysFromNow(-1),
      fundamental = "serve",
      level = "basic",
      isFeatured = false,
      bunnyVideoId = randomUUID(),
      translations = { es: { title: "Saque flotado" } },
    } = seed;
    const slug = `${slugPrefix}-${randomUUID()}`;
    const { id } = takeOnlyRow(
      await database<{ id: string }[]>`
        insert into public.tips (
          slug, bunny_video_id, orientation, duration_seconds, thumbnail_url,
          fundamental, level, is_featured, status, published_at
        ) values (
          ${slug}, ${bunnyVideoId}, 'vertical', 42,
          'https://miniaturas.prueba.volleytip.test/uno.jpg',
          ${fundamental}, ${level}, ${isFeatured}, ${status}, ${publishedAt}
        ) returning id
      `,
      "tips",
    );
    for (const entry of Object.entries(translations)) {
      await insertText(database, id, entry);
    }
    return { id, slug, bunnyVideoId };
  }

  async function removeAll(): Promise<void> {
    await database`delete from public.tips where slug like ${`${slugPrefix}-%`}`;
  }

  return { insert, removeAll };
}
