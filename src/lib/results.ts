import bigfiveMapping from "./bigfive_mapping.json";
import ecrrMapping from "./ecrr_mapping.json";
import gunaMapping from "./guna_mapping.json";
import prakritiMapping from "./prakriti_mapping.json";
import vikritiMapping from "./vikriti_mapping.json";
import { INSTRUMENTS, INSTRUMENT_KEYS, type InstrumentKey } from "./instruments";
import { scoreInstrument, type ScoredResult } from "./scoring";

// Turns stored assessment_results rows into what the results page (and later
// the synthesis) needs: latest result, baseline, and the change between them.
//
// Rows whose item set matches the current instrument are re-scored with the
// current rules on read, so a change between baseline and latest reflects the
// person, not a change in scoring rules. Rows from an older item set (e.g. the
// 24-item Prakriti) keep their stored scores and are marked not comparable.

export interface ResultRow {
  id: string;
  instrument: string;
  instrument_version: string;
  scoring_version: string;
  answers: unknown;
  result: Record<string, unknown>;
  source: string;
  completed_at: string;
}

export interface ResultSnapshot {
  id: string;
  completedAt: string;
  comparable: boolean; // same item set as today, re-scored with current rules
  scored: ScoredResult | null;
  legacy: { label: string | null; scores: Record<string, number> } | null;
  versionNote: string | null;
}

export interface InstrumentHistory {
  key: InstrumentKey;
  count: number;
  latest: ResultSnapshot;
  baseline: ResultSnapshot | null; // first result, when there is more than one
  delta: Record<string, number> | null; // latest.norm - baseline.norm, when both comparable
}

const VERSION_NOTES: Record<string, string> = {
  prakriti24: "Taken on the earlier 24-item version, so it can't be compared point for point.",
  "ipip50-scale-unverified": "Possibly taken on the earlier 1-5 answer scale, so it isn't compared.",
};

function legacyView(result: Record<string, unknown>): ResultSnapshot["legacy"] {
  const legacy = (result.legacy ?? {}) as Record<string, unknown>;
  const labels = legacy.labels as Record<string, string> | undefined;
  return {
    label: (legacy.pattern as string | undefined) ?? (labels ? Object.values(labels).join(" · ") : null),
    scores: (legacy.scores as Record<string, number> | undefined) ?? {},
  };
}

export function snapshot(row: ResultRow): ResultSnapshot {
  const key = row.instrument as InstrumentKey;
  const base = { id: row.id, completedAt: row.completed_at };
  if (row.instrument_version === INSTRUMENTS[key].instrumentVersion) {
    try {
      return { ...base, comparable: true, scored: scoreInstrument(key, row.answers), legacy: null, versionNote: null };
    } catch {
      // Answers that no longer validate fall through to the stored scores.
    }
  }
  return {
    ...base,
    comparable: false,
    scored: null,
    legacy: legacyView(row.result),
    versionNote: VERSION_NOTES[row.instrument_version] ?? "Taken on an earlier version of this questionnaire.",
  };
}

// rows: all of one user's rows, any order.
export function buildHistories(rows: ResultRow[]): Partial<Record<InstrumentKey, InstrumentHistory>> {
  const out: Partial<Record<InstrumentKey, InstrumentHistory>> = {};
  for (const key of INSTRUMENT_KEYS) {
    const own = rows
      .filter((r) => r.instrument === key)
      .sort((a, b) => a.completed_at.localeCompare(b.completed_at));
    if (own.length === 0) continue;

    const latest = snapshot(own[own.length - 1]);
    const baseline = own.length > 1 ? snapshot(own[0]) : null;
    let delta: Record<string, number> | null = null;
    if (baseline?.scored && latest.scored) {
      delta = Object.fromEntries(
        Object.keys(latest.scored.norm).map((d) => [
          d,
          Math.round((latest.scored!.norm[d] - baseline.scored!.norm[d]) * 10) / 10,
        ]),
      );
    }
    out[key] = { key, count: own.length, latest, baseline, delta };
  }
  return out;
}

// ---------- display text from the mapping files ----------

const DOSHA_NAMES: Record<string, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };

export function dimensionName(key: InstrumentKey, dim: string): string {
  switch (key) {
    case "bigfive":
      return bigfiveMapping.dimensions[dim as keyof typeof bigfiveMapping.dimensions]?.label ?? dim;
    case "ecrr":
      return ecrrMapping.dimensions[dim as keyof typeof ecrrMapping.dimensions]?.label ?? dim;
    case "guna":
      return gunaMapping.dimensions[dim as keyof typeof gunaMapping.dimensions]?.label ?? dim;
    default:
      return DOSHA_NAMES[dim] ?? dim;
  }
}

export function classificationDescription(key: InstrumentKey, scored: ScoredResult): string | null {
  const k = scored.classification.key;
  switch (key) {
    case "ecrr":
      return ecrrMapping.combined_patterns.find((p) => p.label === scored.classification.label)?.description ?? null;
    case "guna":
      return gunaMapping.dominance_patterns.find((p) => p.key === k)?.description ?? null;
    case "prakriti":
      return prakritiMapping.dominance_patterns.find((p) => p.key === k)?.description ?? null;
    case "vikriti":
      return vikritiMapping.patterns.find((p) => p.key === k)?.description ?? null;
    default:
      return null;
  }
}

export function bandDescription(key: InstrumentKey, dim: string, label: string): string | null {
  const dims =
    key === "bigfive" ? bigfiveMapping.dimensions : key === "ecrr" ? ecrrMapping.dimensions : key === "guna" ? gunaMapping.dimensions : null;
  const bands = (dims as Record<string, { bands: { label: string; description: string }[] }> | null)?.[dim]?.bands;
  return bands?.find((b) => b.label === label)?.description ?? null;
}

export const FLAG_TEXT: Record<string, string> = {
  straightline: "Every answer was the same, so this result says little. Consider retaking it.",
  low_variance: "Answers barely moved across the scale, so differences between dimensions are small.",
  acquiescence: "Some answers agree with both a statement and its opposite, so read this result loosely.",
  near_boundary: "This result sits close to a boundary. Read it against the neighbouring pattern too.",
  recheck_sama: "Sama is rare. The workbook suggests re-checking before accepting it.",
  many_double_ticks: "Many questions had two ticks, which blurs the result. Ticking one where you can sharpens it.",
  referral:
    "Several columns are strongly elevated. The workbook recommends seeing a qualified Ayurvedic physician rather than self-treating.",
};

export const KIND_TEXT: Record<string, string> = {
  constitution: "Your constitution is understood to stay the same through life. Retakes check that the result is consistent.",
  trait: "A slow-moving trait. Change usually shows over months, not weeks.",
  state: "A current state that shifts with practice, season and lifestyle. Retake it regularly to follow it.",
};

// Vikriti read against the latest Prakriti, per prakriti.json vikriti_check.interpretation.
export function vikritiVsPrakriti(vikriti: ScoredResult, prakritiResult: ScoredResult | null): string | null {
  if (!prakritiResult?.shares || vikriti.classification.key === "settled") return null;
  const leading = Object.entries(prakritiResult.shares).sort((a, b) => b[1] - a[1])[0][0];
  const elevated = Object.keys(vikriti.classification.dimensionLabels ?? {});
  if (elevated.includes(leading)) {
    return `Your leading dosha (${DOSHA_NAMES[leading]}) is the one currently raised: the most common pattern, where your nature has simply increased.`;
  }
  return `What's raised now differs from your leading dosha (${DOSHA_NAMES[leading]}). Season, travel, stress or lifestyle is likely pulling you away from your nature; address the current imbalance first.`;
}
