import vikritiMapping from "@/lib/vikriti_mapping.json";
import { PRACTICES, type Dosha, type LogEntry } from "@/lib/practices";
import type { InstrumentHistory } from "@/lib/results";

const NAME: Record<Dosha, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// For each pair of consecutive Vikriti checks: if a dosha was raised at the
// first, how many days practices for it were logged before the second, and
// what that dosha did. Worded as a pattern, never as cause and effect.
export function practicePatterns(vikriti: InstrumentHistory | undefined, log: LogEntry[]): string[] {
  const points = (vikriti?.all ?? []).filter((s) => s.comparable && s.scored);
  const out: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const from = a.completedAt.slice(0, 10);
    const to = b.completedAt.slice(0, 10);
    for (const d of ["VAT", "PIT", "KAP"] as Dosha[]) {
      const before = a.scored!.raw[d];
      if (before < vikritiMapping.rules.attention_min) continue;
      const days = new Set(log.filter((e) => PRACTICES[e.practice]?.dosha === d && e.done_on > from && e.done_on <= to).map((e) => e.done_on)).size;
      if (days === 0) continue;
      const after = b.scored!.raw[d];
      const span = `Between ${fmt(a.completedAt)} and ${fmt(b.completedAt)} you logged ${NAME[d]} practices on ${days} day${days === 1 ? "" : "s"}`;
      out.push(
        after < before
          ? `${span}, and ${NAME[d]} eased from ${before} to ${after} of 6.`
          : after === before
            ? `${span}; ${NAME[d]} stayed at ${before} of 6.`
            : `${span}, yet ${NAME[d]} rose from ${before} to ${after} of 6. Season, travel or stress may be pulling harder.`,
      );
    }
  }
  return out.reverse().slice(0, 3);
}

// Days per practice over the window, most-done first.
export function practiceCounts(log: LogEntry[]): { id: string; text: string; dosha: string; days: number }[] {
  const counts = new Map<string, number>();
  for (const e of log) if (PRACTICES[e.practice]) counts.set(e.practice, (counts.get(e.practice) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, days]) => ({ id, text: PRACTICES[id].text, dosha: NAME[PRACTICES[id].dosha], days }))
    .sort((a, b) => b.days - a.days);
}

export function lastDays(log: LogEntry[], days: number, now = Date.now()): LogEntry[] {
  const since = new Date(now - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return log.filter((e) => e.done_on >= since);
}
