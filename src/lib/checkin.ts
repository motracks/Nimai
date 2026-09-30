import prakriti from "@/lib/prakriti.json";

// A one-minute check-in between full retakes: four of the Vikriti check's own
// questions, each with a "fine" option, for the last few days rather than the
// last 4-6 weeks. It is never scored as a Vikriti result and is stored apart.

export type Dosha = "VAT" | "PIT" | "KAP";
export type CheckinAnswer = Dosha | "ok";

const FROM_VIKRITI: { key: string; label: string; item: string; ok: string }[] = [
  { key: "sleep", label: "Sleep", item: "VK2", ok: "Sleeping well" },
  { key: "digestion", label: "Digestion", item: "VK1", ok: "Digestion is fine" },
  { key: "mood", label: "Mood", item: "VK3", ok: "Calm and steady" },
  { key: "energy", label: "Energy", item: "VK6", ok: "Energy is fine" },
];

export const CHECKIN_QUESTIONS = FROM_VIKRITI.map(({ key, label, item, ok }) => {
  const source = prakriti.vikriti_check.items.find((i) => i.id === item)!;
  return {
    key,
    label,
    options: [
      ...source.options.map((o) => ({ value: o.dimension as CheckinAnswer, text: o.text })),
      { value: "ok" as CheckinAnswer, text: ok },
    ],
  };
});

export type CheckinAnswers = Record<string, CheckinAnswer>;

export function parseCheckin(input: unknown): CheckinAnswers | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const out: CheckinAnswers = {};
  for (const q of CHECKIN_QUESTIONS) {
    const v = o[q.key];
    if (!q.options.some((opt) => opt.value === v)) return null;
    out[q.key] = v as CheckinAnswer;
  }
  return out;
}

const NAME: Record<Dosha, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };

// The dosha two or more answers point to, if any.
export function checkinLean(a: CheckinAnswers): { dosha: Dosha; name: string; count: number } | null {
  const counts: Record<Dosha, number> = { VAT: 0, PIT: 0, KAP: 0 };
  for (const v of Object.values(a)) if (v !== "ok") counts[v]++;
  const [dosha, count] = (Object.entries(counts) as [Dosha, number][]).sort((x, y) => y[1] - x[1])[0];
  return count >= 2 ? { dosha, name: NAME[dosha], count } : null;
}

export function summariseCheckin(a: CheckinAnswers): string {
  const lean = checkinLean(a);
  const off = CHECKIN_QUESTIONS.filter((q) => a[q.key] !== "ok").map((q) => q.label.toLowerCase());
  if (off.length === 0) return "All four fine.";
  if (lean) return `Leaning ${lean.name}: ${lean.count} of 4 answers point to it.`;
  return `Mixed: ${off.join(", ")} off, no single dosha.`;
}
