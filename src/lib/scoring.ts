import bigfive from "./bigfive.json";
import bigfiveMapping from "./bigfive_mapping.json";
import ecrr from "./ecrr.json";
import ecrrMapping from "./ecrr_mapping.json";
import guna from "./guna.json";
import gunaMapping from "./guna_mapping.json";
import prakriti from "./prakriti.json";
import prakritiMapping from "./prakriti_mapping.json";
import vikritiMapping from "./vikriti_mapping.json";
import type { InstrumentKey } from "./instruments";

// Pure scoring functions. They run on the server (see app/actions/assessments.ts)
// and on read (results page) to re-score stored answers with the current rules.
// Every threshold and label comes from the *_mapping.json files, so the rules
// the synthesis reads and the rules the code applies are the same rules.

export type QualityFlag =
  | "straightline" // every answer identical
  | "low_variance" // answers barely move across the scale
  | "acquiescence" // agrees (or disagrees) with an item and its reverse-keyed opposite
  | "near_boundary" // result sits within a rule's boundary window
  | "recheck_sama" // workbook: Sama is rare, re-check before accepting
  | "many_double_ticks" // workbook: double ticks should be used sparingly
  | "referral"; // Vikriti: several columns strongly elevated

export interface ScoredResult {
  // Native units: 1-6 item means (Likert), points out of 80 (Prakriti), ticks out of 6 (Vikriti).
  raw: Record<string, number>;
  // Absolute intensity per dimension on 0-100, comparable across retakes and instruments.
  norm: Record<string, number>;
  // Relative share per dimension, summing to 100 (Guna, Prakriti). Drives the pattern.
  shares?: Record<string, number>;
  classification: {
    key: string; // which rule fired
    label: string | null;
    dimensionLabels?: Record<string, string>;
    runnerUp?: string | null;
    margin: number | null; // distance to the nearest rule boundary, in the rule's units
  };
  quality: { flags: QualityFlag[] };
}

export class AnswerError extends Error {}

type Dosha = "VAT" | "PIT" | "KAP";
type LikertAnswers = Record<string, number>;
type TickAnswers = Record<string, Dosha[]>;

const DOSHAS: Dosha[] = ["VAT", "PIT", "KAP"];
const doshaLabel: Record<Dosha, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };
const gunaLabel: Record<string, string> = { SAT: "Sattva", RAJ: "Rajas", TAM: "Tamas" };

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const likertNorm = (mean: number) => round1(((mean - 1) / 5) * 100);

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);
}

function patternLabel(
  patterns: { key: string; label: string }[],
  key: string,
  values: Record<string, string> = {},
) {
  const pattern = patterns.find((p) => p.key === key);
  if (!pattern) throw new Error(`No mapping pattern for key "${key}"`);
  return fillTemplate(pattern.label, values);
}

// Band lookup by upper bound, so values that fall between two bands' printed
// ranges (e.g. 2.885 between 2.88 and 2.89) go to the next band up instead of
// becoming "Unknown".
function bandLabel(bands: { range: number[]; label: string }[], value: number) {
  return (bands.find((b) => value <= b.range[1]) ?? bands[bands.length - 1]).label;
}

function sortDesc<K extends string>(values: Record<K, number>): K[] {
  return (Object.keys(values) as K[]).sort((a, b) => values[b] - values[a]);
}

// ---------- answer validation ----------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLikert(
  items: { id: string }[],
  scale: number[],
  input: unknown,
): LikertAnswers {
  if (!isPlainObject(input)) throw new AnswerError("Answers must be an object");
  const ids = new Set(items.map((i) => i.id));
  for (const key of Object.keys(input)) {
    if (!ids.has(key)) throw new AnswerError(`Unknown item ${key}`);
  }
  const out: LikertAnswers = {};
  for (const item of items) {
    const v = input[item.id];
    if (typeof v !== "number" || !scale.includes(v)) {
      throw new AnswerError(`Item ${item.id} needs an answer from ${scale[0]} to ${scale[scale.length - 1]}`);
    }
    out[item.id] = v;
  }
  return out;
}

function parseTicks(
  items: { id: string; options: { dimension: string }[] }[],
  input: unknown,
  { min, max }: { min: number; max: number },
): TickAnswers {
  if (!isPlainObject(input)) throw new AnswerError("Answers must be an object");
  const ids = new Set(items.map((i) => i.id));
  for (const key of Object.keys(input)) {
    if (!ids.has(key)) throw new AnswerError(`Unknown item ${key}`);
  }
  const out: TickAnswers = {};
  for (const item of items) {
    const v = input[item.id] ?? [];
    if (!Array.isArray(v)) throw new AnswerError(`Item ${item.id} must be a list of ticks`);
    const allowed = new Set(item.options.map((o) => o.dimension));
    if (v.some((d) => typeof d !== "string" || !allowed.has(d))) {
      throw new AnswerError(`Item ${item.id} has an unknown option`);
    }
    if (new Set(v).size !== v.length) throw new AnswerError(`Item ${item.id} ticks an option twice`);
    if (v.length < min || v.length > max) {
      throw new AnswerError(`Item ${item.id} needs ${min === max ? min : `${min}-${max}`} ticks`);
    }
    out[item.id] = v as Dosha[];
  }
  return out;
}

// ---------- shared Likert pieces ----------

interface LikertItem {
  id: string;
  dimension: string;
  reverse?: boolean;
}

function likertMeans<D extends string>(items: LikertItem[], answers: LikertAnswers, dims: D[]) {
  const sums = Object.fromEntries(dims.map((d) => [d, 0])) as Record<D, number>;
  const counts = Object.fromEntries(dims.map((d) => [d, 0])) as Record<D, number>;
  for (const item of items) {
    const raw = answers[item.id];
    const dim = item.dimension as D;
    sums[dim] += item.reverse ? 7 - raw : raw;
    counts[dim] += 1;
  }
  return Object.fromEntries(dims.map((d) => [d, sums[d] / counts[d]])) as Record<D, number>;
}

function likertQuality(items: LikertItem[], answers: LikertAnswers): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const values = items.map((i) => answers[i.id]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  if (sd === 0) flags.push("straightline");
  else if (sd < 0.5) flags.push("low_variance");

  // For each dimension with both keyings, a consistent responder's forward
  // and reverse raw means add up to about 7 (scale 1-6). Agreeing with both
  // "I talk a lot" and "I don't talk a lot" pushes the sum well above 7.
  const byDim = new Map<string, { f: number[]; r: number[] }>();
  for (const item of items) {
    const entry = byDim.get(item.dimension) ?? { f: [], r: [] };
    (item.reverse ? entry.r : entry.f).push(answers[item.id]);
    byDim.set(item.dimension, entry);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const offsets = [...byDim.values()]
    .filter((e) => e.f.length > 0 && e.r.length > 0)
    .map((e) => avg(e.f) + avg(e.r) - 7);
  if (offsets.length > 0 && Math.abs(avg(offsets)) >= 1.5) flags.push("acquiescence");

  return flags;
}

// ---------- Big Five ----------

const BIGFIVE_DIMS = ["EXT", "AGR", "CON", "NEU", "OPN"] as const;
type BigFiveDim = (typeof BIGFIVE_DIMS)[number];

export function scoreBigFive(input: unknown): ScoredResult {
  const answers = parseLikert(bigfive.items, bigfive.response_scale.values, input);
  const means = likertMeans(bigfive.items, answers, [...BIGFIVE_DIMS]);

  const raw: Record<string, number> = {};
  const norm: Record<string, number> = {};
  const dimensionLabels: Record<string, string> = {};
  for (const dim of BIGFIVE_DIMS) {
    raw[dim] = round2(means[dim]);
    norm[dim] = likertNorm(means[dim]);
    dimensionLabels[dim] = bandLabel(bigfiveMapping.dimensions[dim as BigFiveDim].bands, means[dim]);
  }

  return {
    raw,
    norm,
    classification: { key: "bands", label: null, dimensionLabels, margin: null },
    quality: { flags: likertQuality(bigfive.items, answers) },
  };
}

// ---------- ECR-R ----------

export function scoreEcrr(input: unknown): ScoredResult {
  const answers = parseLikert(ecrr.items, ecrr.response_scale.values, input);
  const means = likertMeans(ecrr.items, answers, ["ANX", "AVD"]);
  const { cutoff, near_boundary } = ecrrMapping.rules;

  const anxHigh = means.ANX > cutoff;
  const avdHigh = means.AVD > cutoff;
  const condition = `ANX ${anxHigh ? "high" : "low"}, AVD ${avdHigh ? "high" : "low"}`;
  const pattern = ecrrMapping.combined_patterns.find((p) => p.condition === condition);
  if (!pattern) throw new Error(`No ECR-R pattern for "${condition}"`);

  const margin = Math.min(Math.abs(means.ANX - cutoff), Math.abs(means.AVD - cutoff));
  const flags = likertQuality(ecrr.items, answers);
  if (margin < near_boundary) flags.push("near_boundary");

  return {
    raw: { ANX: round2(means.ANX), AVD: round2(means.AVD) },
    norm: { ANX: likertNorm(means.ANX), AVD: likertNorm(means.AVD) },
    classification: {
      key: condition.replace(/, /g, "_").replace(/ /g, "_").toLowerCase(),
      label: pattern.label,
      dimensionLabels: {
        ANX: bandLabel(ecrrMapping.dimensions.ANX.bands, means.ANX),
        AVD: bandLabel(ecrrMapping.dimensions.AVD.bands, means.AVD),
      },
      margin: round2(margin),
    },
    quality: { flags },
  };
}

// ---------- Guna ----------

const GUNA_DIMS = ["SAT", "RAJ", "TAM"] as const;
type GunaDim = (typeof GUNA_DIMS)[number];

export function scoreGuna(input: unknown): ScoredResult {
  const answers = parseLikert(guna.items, guna.response_scale.values, input);
  const means = likertMeans(guna.items, answers, [...GUNA_DIMS]);
  const r = gunaMapping.rules;

  // Share of the total above the scale floor (mean - 1), so shares span 0-100
  // instead of being squeezed toward 33% by the floor of 1.
  const aboveFloor = Object.fromEntries(GUNA_DIMS.map((d) => [d, means[d] - 1])) as Record<GunaDim, number>;
  const total = GUNA_DIMS.reduce((a, d) => a + aboveFloor[d], 0);
  const shares = Object.fromEntries(
    GUNA_DIMS.map((d) => [d, total > 0 ? (aboveFloor[d] / total) * 100 : 100 / 3]),
  ) as Record<GunaDim, number>;

  const [first, second, third] = sortDesc(shares);
  const lead = shares[first] - shares[second];

  let key: string;
  if (shares[first] >= r.dominant_min && lead >= r.dominant_min_lead) key = "dominant";
  else if (shares[first] >= r.blend_min && shares[second] >= r.blend_min && shares[third] < r.blend_third_max)
    key = "blend";
  else if (GUNA_DIMS.every((d) => Math.abs(shares[d] - 100 / 3) <= r.balanced_tolerance)) key = "balanced";
  else key = "leaning";

  const label = patternLabel(gunaMapping.dominance_patterns, key, {
    guna: gunaLabel[first],
    guna_a: gunaLabel[first],
    guna_b: gunaLabel[second],
  });

  const flags = likertQuality(guna.items, answers);

  return {
    raw: Object.fromEntries(GUNA_DIMS.map((d) => [d, round2(means[d])])),
    norm: Object.fromEntries(GUNA_DIMS.map((d) => [d, likertNorm(means[d])])),
    shares: Object.fromEntries(GUNA_DIMS.map((d) => [d, round2(shares[d])])),
    classification: {
      key,
      label,
      dimensionLabels: Object.fromEntries(
        GUNA_DIMS.map((d) => [d, bandLabel(gunaMapping.dimensions[d].bands, means[d])]),
      ),
      runnerUp: gunaLabel[second],
      margin: round1(lead),
    },
    quality: { flags },
  };
}

// ---------- Prakriti ----------

const PRAKRITI_MAX_POINTS = prakriti.sections.reduce((a, s) => a + s.max_points, 0); // 80

// One tick = 2 points to that dosha; two ticks (allowed sparingly) = 1 point
// each, per prakriti.json scoring_notes. Every item is required.
export function scorePrakriti(input: unknown): ScoredResult {
  const answers = parseTicks(prakriti.items, input, { min: 1, max: 2 });
  const r = prakritiMapping.rules;

  const points: Record<Dosha, number> = { VAT: 0, PIT: 0, KAP: 0 };
  let doubles = 0;
  for (const item of prakriti.items) {
    const chosen = answers[item.id];
    if (chosen.length === 2) doubles += 1;
    for (const dim of chosen) points[dim] += chosen.length === 1 ? 2 : 1;
  }

  const shares = Object.fromEntries(
    DOSHAS.map((d) => [d, (points[d] / PRAKRITI_MAX_POINTS) * 100]),
  ) as Record<Dosha, number>;
  const [first, second, third] = sortDesc(shares);
  const spread = shares[first] - shares[third];
  const lead = shares[first] - shares[second];

  // Workbook order, first match wins. Margin = distance to the nearest
  // threshold that would change the result.
  let key: string;
  let margin: number;
  if (spread <= r.sama_max_spread) {
    key = "sama";
    margin = r.sama_max_spread - spread;
  } else if (lead >= r.ekadosha_min_lead) {
    key = "ekadosha";
    margin = Math.min(lead - r.ekadosha_min_lead, spread - r.sama_max_spread);
  } else {
    key = "dvandva";
    margin = Math.min(r.ekadosha_min_lead - lead, spread - r.sama_max_spread);
  }

  const label = patternLabel(prakritiMapping.dominance_patterns, key, {
    dosha: doshaLabel[first],
    dosha_a: doshaLabel[first],
    dosha_b: doshaLabel[second],
  });

  const flags: QualityFlag[] = [];
  if (margin <= r.boundary_window) flags.push("near_boundary");
  if (key === "sama") flags.push("recheck_sama");
  if (doubles / prakriti.items.length > r.double_tick_warning_share) flags.push("many_double_ticks");

  const rounded = Object.fromEntries(DOSHAS.map((d) => [d, round2(shares[d])]));
  return {
    raw: { ...points },
    norm: rounded,
    shares: rounded,
    classification: { key, label, runnerUp: doshaLabel[second], margin: round2(margin) },
    quality: { flags },
  };
}

// ---------- Vikriti ----------

// Separate 6-item current-state check (prakriti.vikriti_check): ticks per
// column, 0-6 each. Never merged into Prakriti's percentages. Any number of
// options may be ticked per item, including none.
export function scoreVikriti(input: unknown): ScoredResult {
  const vk = prakriti.vikriti_check;
  const answers = parseTicks(vk.items, input, { min: 0, max: 3 });
  const r = vikritiMapping.rules;

  const ticks: Record<Dosha, number> = { VAT: 0, PIT: 0, KAP: 0 };
  for (const item of vk.items) for (const dim of answers[item.id]) ticks[dim] += 1;

  const ordered = sortDesc(ticks);
  const elevated = ordered.filter((d) => ticks[d] >= r.attention_min);
  const strong = ordered.filter((d) => ticks[d] >= r.referral_min);

  let key: string;
  if (strong.length >= r.referral_min_columns) key = "referral";
  else if (elevated.length > 0) key = "elevated";
  else key = "settled";

  const label = patternLabel(vikritiMapping.patterns, key, {
    doshas: elevated.map((d) => doshaLabel[d]).join(" & "),
  });

  return {
    raw: { ...ticks },
    norm: Object.fromEntries(DOSHAS.map((d) => [d, round1((ticks[d] / vk.items.length) * 100)])),
    classification: {
      key,
      label,
      dimensionLabels: Object.fromEntries(elevated.map((d) => [d, "elevated"])),
      margin: null,
    },
    quality: { flags: key === "referral" ? ["referral"] : [] },
  };
}

// ---------- dispatch ----------

const SCORERS: Record<InstrumentKey, (input: unknown) => ScoredResult> = {
  bigfive: scoreBigFive,
  ecrr: scoreEcrr,
  guna: scoreGuna,
  prakriti: scorePrakriti,
  vikriti: scoreVikriti,
};

// Validates the answers against the current instrument and scores them.
// Throws AnswerError for answers that don't fit the instrument.
export function scoreInstrument(key: InstrumentKey, answers: unknown): ScoredResult {
  return SCORERS[key](answers);
}

// Normalises validated answers for storage (Vikriti fills unticked items with []).
export function normaliseAnswers(key: InstrumentKey, answers: unknown): Record<string, unknown> {
  switch (key) {
    case "bigfive":
      return parseLikert(bigfive.items, bigfive.response_scale.values, answers);
    case "ecrr":
      return parseLikert(ecrr.items, ecrr.response_scale.values, answers);
    case "guna":
      return parseLikert(guna.items, guna.response_scale.values, answers);
    case "prakriti":
      return parseTicks(prakriti.items, answers, { min: 1, max: 2 });
    case "vikriti":
      return parseTicks(prakriti.vikriti_check.items, answers, { min: 0, max: 3 });
  }
}
