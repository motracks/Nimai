import resonances from "./analysis/resonances.json";
import gunaContent from "./analysis/guna.json";
import ecrrContent from "./analysis/ecrr.json";
import { analyse, levelOf, progressionLine, type Analysis, type AnalysisSection } from "./analysis";
import { INSTRUMENTS, INSTRUMENT_KEYS, type InstrumentKey } from "./instruments";
import { dimensionName, type InstrumentHistory } from "./results";
import type { ScoredResult } from "./scoring";
import doshaGuide from "./prakriti_dosha_guide.json";

// The combined profile: every framework read in its own terms, then placed in
// dialogue. Deterministic and rule-based like the per-test analyses; the
// resonance rules live in analysis/resonances.json.
//
// buildSynthesisInput() produces the same information as one versioned JSON
// document, ready to hand to a language model later if a written narrative is
// wanted. The profile itself does not need one.

export type Histories = Partial<Record<InstrumentKey, InstrumentHistory>>;

export interface VedicChart {
  moon_nakshatra?: { name: string; pada: number };
  moon_reliable?: boolean;
  moon_range?: { signs: string[]; nakshatras: string[] } | null;
  chandra_lagna?: { sign: string };
  ascendant?: { sign: string } | null;
  ascendant_reliable?: boolean;
  planets?: { name: string; sign: string }[];
}

export interface Finding {
  id: string;
  kind: "resonate" | "differ";
  text: string;
  between: [string, string];
}

export interface Profile {
  taken: InstrumentKey[];
  missing: InstrumentKey[];
  stale: { key: InstrumentKey; completedAt: string }[];
  sections: AnalysisSection[];
  resonances: Finding[];
  differences: Finding[];
  progression: { key: InstrumentKey; line: string }[];
  practice: AnalysisSection | null;
  analyses: Partial<Record<InstrumentKey, Analysis>>;
}

type Dosha = "VAT" | "PIT" | "KAP";
const DAY_MS = 24 * 60 * 60 * 1000;

function latestScored(h: Histories, key: InstrumentKey): ScoredResult | null {
  return h[key]?.latest.scored ?? null;
}

const label = (instrument: string, dim: string) =>
  `${dimensionName(instrument as InstrumentKey, dim)} (${INSTRUMENTS[instrument as InstrumentKey].label.split(" (")[0]})`;

export function findResonances(h: Histories): Finding[] {
  const out: Finding[] = [];
  for (const rule of resonances.rules) {
    const a = latestScored(h, rule.anchor.instrument as InstrumentKey);
    const b = latestScored(h, rule.other.instrument as InstrumentKey);
    if (!a || !b) continue;
    if (levelOf(rule.anchor.instrument as InstrumentKey, a, rule.anchor.dim) !== "high") continue;
    const level = levelOf(rule.other.instrument as InstrumentKey, b, rule.other.dim);
    if (level === "mid") continue;
    const kind = level === rule.other.expect ? "resonate" : "differ";
    out.push({
      id: rule.id,
      kind,
      text: kind === "resonate" ? rule.resonate : rule.differ,
      between: [label(rule.anchor.instrument, rule.anchor.dim), label(rule.other.instrument, rule.other.dim)],
    });
  }
  return out;
}

function vedicLines(chart: VedicChart | null): string[] {
  if (!chart?.moon_nakshatra) return [];
  const lines = [
    chart.moon_reliable === false
      ? `Moon nakshatra: ${chart.moon_range?.nakshatras.join(" or ")} (birth time unknown)`
      : `Moon nakshatra: ${chart.moon_nakshatra.name}, pada ${chart.moon_nakshatra.pada}`,
  ];
  if (chart.ascendant_reliable && chart.ascendant) lines.push(`Ascendant: ${chart.ascendant.sign}`);
  else if (chart.chandra_lagna) lines.push(`Chandra Lagna: ${chart.chandra_lagna.sign}`);
  return lines;
}

function practiceNow(h: Histories): AnalysisSection | null {
  const items: string[] = [];
  const vikriti = latestScored(h, "vikriti");
  const elevated = vikriti
    ? (Object.keys(vikriti.raw) as Dosha[])
        .filter((d) => levelOf("vikriti", vikriti, d) === "high")
        .sort((a, b) => vikriti.raw[b] - vikriti.raw[a])
    : [];
  const prakriti = latestScored(h, "prakriti");

  // Current imbalance first (Vikriti), then the constitution's own needs.
  const dosha: Dosha | null =
    elevated[0] ??
    (prakriti && prakriti.classification.key !== "sama"
      ? ((Object.keys(prakriti.shares!) as Dosha[]).sort((a, b) => prakriti.shares![b] - prakriti.shares![a])[0] ?? null)
      : null);
  if (dosha) {
    const g = doshaGuide.doshas[dosha];
    const why = elevated[0] ? `to settle the ${g.label} that is raised now` : `for your ${g.label} constitution`;
    items.push(`Asana ${why}: ${g.asana}`, `Pranayama: ${g.pranayama}`, `Meditation: ${g.meditation}`);
  }

  const guna = latestScored(h, "guna");
  if (guna) {
    const lead = (Object.keys(guna.shares!) as ("SAT" | "RAJ" | "TAM")[]).sort(
      (a, b) => guna.shares![b] - guna.shares![a],
    )[0];
    items.push(gunaContent.gunas[lead].supports[0]);
  }

  const ecrr = latestScored(h, "ecrr");
  if (ecrr?.classification.label && ecrr.classification.label !== "Secure") {
    items.push(ecrrContent.patterns[ecrr.classification.label as keyof typeof ecrrContent.patterns].growth[0]);
  }

  return items.length ? { title: "What to practise now", items } : null;
}

export function buildProfile(h: Histories, vedic: VedicChart | null, now = Date.now()): Profile {
  const taken = INSTRUMENT_KEYS.filter((k) => h[k]?.latest.scored);
  const missing = INSTRUMENT_KEYS.filter((k) => !h[k]?.latest.scored);
  const stale = taken
    .filter((k) => now - new Date(h[k]!.latest.completedAt).getTime() > INSTRUMENTS[k].suggestedRetakeDays * DAY_MS)
    .map((k) => ({ key: k, completedAt: h[k]!.latest.completedAt }));

  const prakritiLatest = latestScored(h, "prakriti");
  const analyses: Partial<Record<InstrumentKey, Analysis>> = {};
  for (const k of taken) analyses[k] = analyse(h[k]!, prakritiLatest) ?? undefined;

  const sections: AnalysisSection[] = [];

  const nature: string[] = [];
  if (analyses.prakriti) nature.push(`Prakriti: ${analyses.prakriti.headline}. ${analyses.prakriti.summary}`);
  if (analyses.bigfive) nature.push(`Personality: ${analyses.bigfive.summary}.`);
  const vedicItems = vedicLines(vedic);
  if (nature.length || vedicItems.length)
    sections.push({ title: "Your nature", paragraphs: nature, items: vedicItems.length ? vedicItems : undefined });

  const current: string[] = [];
  if (analyses.guna) current.push(`Guna: ${analyses.guna.headline}. ${gunaLead(h)}`);
  if (analyses.vikriti) {
    const rel = analyses.vikriti.sections.find((s) => s.title === "Compared with your Prakriti")?.paragraphs?.[0];
    current.push(`Vikriti: ${analyses.vikriti.headline}.${rel ? ` ${rel}` : ""}`);
  }
  if (current.length) sections.push({ title: "Right now", paragraphs: current });

  if (analyses.ecrr) {
    const inPractice = analyses.ecrr.sections.find((s) => s.title === "In practice")?.paragraphs?.[0];
    sections.push({
      title: "In relationships",
      paragraphs: [`${analyses.ecrr.headline}. ${inPractice ?? ""}`.trim()],
    });
  }

  const findings = findResonances(h);
  const progression = taken
    .map((k) => ({ key: k, line: progressionLine(h[k]) }))
    .filter((p): p is { key: InstrumentKey; line: string } => p.line != null);

  return {
    taken,
    missing,
    stale,
    sections,
    resonances: findings.filter((f) => f.kind === "resonate"),
    differences: findings.filter((f) => f.kind === "differ"),
    progression,
    practice: practiceNow(h),
    analyses,
  };
}

function gunaLead(h: Histories): string {
  const guna = latestScored(h, "guna")!;
  const lead = (Object.keys(guna.shares!) as ("SAT" | "RAJ" | "TAM")[]).sort(
    (a, b) => guna.shares![b] - guna.shares![a],
  )[0];
  return gunaContent.gunas[lead].leads;
}

// ---------- structured input for an optional written synthesis ----------

export const SYNTHESIS_INPUT_VERSION = "1";

export function buildSynthesisInput(h: Histories, vedic: VedicChart | null) {
  const instruments = Object.fromEntries(
    INSTRUMENT_KEYS.filter((k) => h[k]?.latest.scored).map((k) => {
      const hist = h[k]!;
      const s = hist.latest.scored!;
      return [
        k,
        {
          instrument_version: INSTRUMENTS[k].instrumentVersion,
          scoring_version: INSTRUMENTS[k].scoringVersion,
          kind: INSTRUMENTS[k].kind,
          completed_at: hist.latest.completedAt,
          result_id: hist.latest.id,
          label: s.classification.label,
          dimension_labels: s.classification.dimensionLabels ?? null,
          raw: s.raw,
          norm: s.norm,
          shares: s.shares ?? null,
          margin: s.classification.margin,
          runner_up: s.classification.runnerUp ?? null,
          quality_flags: s.quality.flags,
          baseline: hist.baseline
            ? {
                result_id: hist.baseline.id,
                completed_at: hist.baseline.completedAt,
                comparable: hist.baseline.comparable,
                label: hist.baseline.scored?.classification.label ?? hist.baseline.legacy?.label ?? null,
                norm: hist.baseline.scored?.norm ?? null,
              }
            : null,
          change_since_baseline: hist.delta,
        },
      ];
    }),
  );

  return {
    version: SYNTHESIS_INPUT_VERSION,
    instruments,
    vedic_chart: vedic
      ? {
          moon_nakshatra: vedic.moon_nakshatra ?? null,
          moon_reliable: vedic.moon_reliable ?? null,
          moon_range: vedic.moon_range ?? null,
          chandra_lagna: vedic.chandra_lagna?.sign ?? null,
          ascendant: vedic.ascendant_reliable ? (vedic.ascendant?.sign ?? null) : null,
          planets: vedic.planets ?? [],
        }
      : null,
    resonances: findResonances(h).map(({ id, kind, between }) => ({ id, kind, between })),
  };
}
