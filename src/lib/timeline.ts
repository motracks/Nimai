import type { InstrumentKey } from "@/lib/instruments";
import { dimensionName, type InstrumentHistory } from "@/lib/results";
import { SEASON_LABEL, describeContext, seasonYear } from "@/lib/context";

// Reference categorical palette, first five slots, validated for adjacent
// pairs on the white card (CVD ΔE ≥ 9.1, normal-vision ΔE ≥ 19.6). Three sit
// below 3:1 contrast, so the chart always has a legend and a table view.
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

// Fixed dimension order per test, so a colour always means the same dimension.
const ORDER: Record<InstrumentKey, string[]> = {
  bigfive: ["EXT", "AGR", "CON", "NEU", "OPN"],
  ecrr: ["ANX", "AVD"],
  guna: ["SAT", "RAJ", "TAM"],
  prakriti: ["VAT", "PIT", "KAP"],
  vikriti: ["VAT", "PIT", "KAP"],
};

// Guna and Prakriti are read as a balance, so their relative shares are
// plotted; everything else uses the 0-100 intensity.
const USES_SHARES: InstrumentKey[] = ["guna", "prakriti"];

// Changes smaller than this are reported as steady, matching the baseline view.
export const STEADY_POINTS = 5;

export interface Timeline {
  dates: string[];
  away: boolean[]; // taken away from home: shown, but left out of the trend
  notes: (string | null)[]; // season and place, when recorded
  series: { dim: string; label: string; color: string; values: number[] }[];
  measure: "share" | "score";
}

export function timeline(history: InstrumentHistory): Timeline | null {
  const points = history.all.filter((s) => s.comparable && s.scored);
  if (points.length < 2) return null;
  const shares = USES_SHARES.includes(history.key);
  const pick = (dim: string, i: number) => {
    const scored = points[i].scored!;
    return Math.round((shares ? scored.shares![dim] : scored.norm[dim]) ?? 0);
  };
  return {
    dates: points.map((p) => p.completedAt),
    away: points.map((p) => p.context?.away ?? false),
    notes: points.map((p) => (p.context ? describeContext(p.context) : null)),
    measure: shares ? "share" : "score",
    series: ORDER[history.key].map((dim, k) => ({
      dim,
      label: dimensionName(history.key, dim),
      color: SERIES_COLORS[k],
      values: points.map((_, i) => pick(dim, i)),
    })),
  };
}

const month = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// One sentence on the biggest movement since the first result, or "steady".
// Results taken away from home are left out when at least two remain, so a
// holiday in a different climate doesn't read as a trend.
export function trendSentence(t: Timeline): string {
  const home = t.dates.map((_, i) => i).filter((i) => !t.away[i]);
  const idx = home.length >= 2 && home.length < t.dates.length ? home : t.dates.map((_, i) => i);
  const skipped = idx.length < t.dates.length;
  const firstI = idx[0];
  const lastI = idx[idx.length - 1];
  const n = idx.length;
  const moves = t.series
    .map((s) => ({ label: s.label, change: s.values[lastI] - s.values[firstI] }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const since = month(t.dates[firstI]);
  const note = skipped ? " Results taken away from home are shown but not counted." : "";
  const top = moves[0];
  if (Math.abs(top.change) < STEADY_POINTS)
    return `Steady across ${n} results since ${since}: no dimension has moved ${STEADY_POINTS} points or more.${note}`;
  const dir = (c: number) => (c > 0 ? "risen" : "come down");
  const first = `${top.label} has ${dir(top.change)} ${Math.abs(top.change)} points since ${since}, across ${n} results`;
  const second = moves[1] && Math.abs(moves[1].change) >= STEADY_POINTS ? `; ${moves[1].label} has ${dir(moves[1].change)} ${Math.abs(moves[1].change)}` : "";
  return `${first}${second}.${note}`;
}

// The latest result against the most recent one from the same season in an
// earlier year, preferring results taken at home.
export function sameSeasonLastYear(history: InstrumentHistory): string | null {
  const t = timeline(history);
  const points = history.all.filter((s) => s.comparable && s.scored);
  if (!t) return null;
  const last = points.length - 1;
  const now = points[last].context;
  if (!now) return null;
  const year = (i: number) => seasonYear(new Date(points[i].completedAt), points[i].context!.hemisphere);
  const candidates = points
    .map((p, i) => i)
    .filter((i) => i < last && points[i].context?.season === now.season && year(i) < year(last));
  if (candidates.length === 0) return null;
  const atHome = candidates.filter((i) => !points[i].context!.away);
  const pick = (atHome.length ? atHome : candidates).at(-1)!;
  const unit = t.measure === "share" ? "%" : "";
  const changes = t.series
    .map((s) => `${s.label} ${s.values[pick]}${unit} → ${s.values[last]}${unit}`)
    .join(", ");
  return `Same season in ${year(pick)} (${SEASON_LABEL[now.season]}): ${changes}.`;
}
