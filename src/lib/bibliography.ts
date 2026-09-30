import registry from "@/lib/knowledge/sources.json";
import attached from "@/lib/knowledge/attached.json";
import charaka from "@/lib/knowledge/charaka-sharira.json";
import frawley from "@/lib/knowledge/frawley-mind.json";
import gita from "@/lib/knowledge/gita-easwaran.json";
import handbook from "@/lib/knowledge/handbook-attachment.json";
import harness from "@/lib/knowledge/harness-nakshatras.json";
import johnson from "@/lib/knowledge/johnson-hold-me-tight.json";
import lad from "@/lib/knowledge/lad-textbook.json";
import little from "@/lib/knowledge/little.json";
import mccraeCosta from "@/lib/knowledge/mccrae-costa.json";
import mikulincer from "@/lib/knowledge/mikulincer-shaver.json";
import nettle from "@/lib/knowledge/nettle.json";
import pooleHeller from "@/lib/knowledge/poole-heller.json";
import svobodaLife from "@/lib/knowledge/svoboda-life.json";
import svoboda from "@/lib/knowledge/svoboda.json";

export type SourceKind = "classical" | "research" | "practitioner" | "workbook";

export interface Source {
  id: string;
  author: string;
  title: string;
  edition: string | null;
  publisher: string | null;
  year: number | null;
  isbn: string | null;
  format: string;
  kind: SourceKind;
  read: string;
  used_for: string[];
  verified: string;
}

export const KNOWLEDGE_FILES = [
  attached, charaka, frawley, gita, handbook, harness, johnson, lad, little,
  mccraeCosta, mikulincer, nettle, pooleHeller, svobodaLife, svoboda,
] as { source: { id: string }; claims?: unknown[]; entries?: Record<string, unknown> }[];

const claimCounts = new Map(
  KNOWLEDGE_FILES.map((f) => [f.source.id, f.claims ? f.claims.length : Object.keys(f.entries ?? {}).length]),
);

export const SOURCES: Source[] = Object.entries(registry.sources).map(([id, s]) => ({ id, ...(s as Omit<Source, "id">) }));

export const INSTRUMENT_SOURCES = registry.instruments;

export const KIND_ORDER: { kind: SourceKind; heading: string; blurb: string }[] = [
  { kind: "classical", heading: "Classical texts", blurb: "Primary texts of the tradition, in translation." },
  { kind: "research", heading: "Research", blurb: "Academic books summarising peer-reviewed research." },
  { kind: "practitioner", heading: "Practitioner books", blurb: "Books by experienced teachers and clinicians." },
  { kind: "workbook", heading: "Course material", blurb: "Unpublished teaching material." },
];

export function sourcesByKind(kind: SourceKind): Source[] {
  return SOURCES.filter((s) => s.kind === kind).sort((a, b) => a.author.localeCompare(b.author));
}

// Long-form entry: Author (Year). Title (edition). Publisher. ISBN.
export function citation(s: Source): string {
  const year = s.year ? ` (${s.year})` : "";
  const edition = s.edition ? ` (${s.edition})` : "";
  const publisher = s.publisher ? ` ${s.publisher}.` : "";
  const isbn = s.isbn ? ` ISBN ${s.isbn}.` : "";
  return `${s.author}${year}. ${s.title}${edition}.${publisher}${isbn}`;
}

export function claimCount(id: string): number {
  return claimCounts.get(id) ?? 0;
}
