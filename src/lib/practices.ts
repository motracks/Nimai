import guide from "@/lib/prakriti_dosha_guide.json";

export type Dosha = "VAT" | "PIT" | "KAP";

// Every practice the Today card can suggest, by stable id, so the log keeps
// its meaning if the wording changes.
export const PRACTICES: Record<string, { dosha: Dosha; text: string }> = Object.fromEntries(
  (["VAT", "PIT", "KAP"] as Dosha[]).flatMap((dosha) =>
    guide.doshas[dosha].today.do.map((p) => [p.id, { dosha, text: p.text }]),
  ),
);

export interface LogEntry {
  practice: string;
  done_on: string; // YYYY-MM-DD, the person's local date
}

export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// A local date sent by the browser is accepted only within a day of the
// server's date, which covers every time zone.
export function acceptableDay(day: unknown, now = new Date()): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(`${day}T12:00:00Z`);
  return Number.isFinite(t) && Math.abs(t - now.getTime()) <= 36 * 60 * 60 * 1000;
}
