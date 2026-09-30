import content from "@/lib/analysis/nakshatras.json";
import harness from "@/lib/knowledge/harness-nakshatras.json";

// The 27 nakshatras, in order from 0° Aries, joining our reading
// (analysis/nakshatras.json) with the facts paraphrased from Harness (1999).
// Names follow the chart calculation; a few are spelled differently in the book.

type Book = (typeof harness.entries)[keyof typeof harness.entries];

export interface Nakshatra {
  name: string;
  ruler: string;
  deity: string;
  symbol: string;
  gana: string | null;
  motivation: string;
  qualities: string[] | null;
  shakti: { name: string; power: string };
  tendency: string;
  slug: string;
  index: number; // 1-27
  range: string;
  animal: string | null;
  pages: string;
  traits: string[];
  shadow: string | null;
}

export const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

export const NAKSHATRAS: Nakshatra[] = Object.entries(content.nakshatras).map(([name, c], i) => {
  const bookName = "source_spelling" in c ? (c.source_spelling as string) : name;
  const b = harness.entries[bookName as keyof typeof harness.entries] as Book;
  return {
    name,
    ruler: c.ruler,
    deity: c.deity,
    symbol: c.symbol,
    gana: c.gana,
    motivation: c.motivation,
    qualities: c.qualities,
    shakti: c.shakti,
    tendency: c.tendency,
    slug: slugOf(name),
    index: i + 1,
    range: b.range,
    animal: b.animal,
    pages: b.pages,
    traits: b.moon_traits,
    shadow: b.moon_shadow,
  };
});

export const nakshatraBySlug = (slug: string) => NAKSHATRAS.find((n) => n.slug === slug) ?? null;
export const nakshatraByName = (name: string) => NAKSHATRAS.find((n) => n.name === name) ?? null;

// Pada (quarter) 1-4 of a nakshatra: each spans 3°20'.
export const PADA_NOTE =
  "Each nakshatra spans 13°20' and is split into four padas (quarters) of 3°20'. The pada fine-tunes the reading; the nakshatra itself carries the main meaning.";
