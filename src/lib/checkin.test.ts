import { describe, expect, it } from "vitest";
import prakriti from "./prakriti.json";
import { CHECKIN_QUESTIONS, checkinLean, parseCheckin, summariseCheckin } from "./checkin";
import { buildHistories, type ResultRow } from "./results";
import { todayFocus } from "./today";

const vata2 = { sleep: "VAT", digestion: "ok", mood: "VAT", energy: "PIT" } as const;

describe("check-in", () => {
  it("reuses the Vikriti check's own wording, with a 'fine' option each", () => {
    expect(CHECKIN_QUESTIONS.map((q) => q.key)).toEqual(["sleep", "digestion", "mood", "energy"]);
    const sleep = prakriti.vikriti_check.items.find((i) => i.id === "VK2")!;
    expect(CHECKIN_QUESTIONS[0].options.slice(0, 3).map((o) => o.text)).toEqual(sleep.options.map((o) => o.text));
    expect(CHECKIN_QUESTIONS.every((q) => q.options.at(-1)!.value === "ok")).toBe(true);
  });

  it("accepts only complete, known answers", () => {
    expect(parseCheckin(vata2)).toEqual(vata2);
    expect(parseCheckin({ ...vata2, energy: undefined })).toBeNull();
    expect(parseCheckin({ ...vata2, mood: "anxious" })).toBeNull();
  });

  it("leans only when two or more answers agree", () => {
    expect(checkinLean(vata2)).toEqual({ dosha: "VAT", name: "Vata", count: 2 });
    expect(checkinLean({ sleep: "VAT", digestion: "PIT", mood: "KAP", energy: "ok" })).toBeNull();
    expect(summariseCheckin({ sleep: "ok", digestion: "ok", mood: "ok", energy: "ok" })).toBe("All four fine.");
    expect(summariseCheckin(vata2)).toBe("Leaning Vata: 2 of 4 answers point to it.");
  });

  it("feeds the Today card for a week, below a raised Vikriti", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const settled: ResultRow = {
      id: "v", instrument: "vikriti", instrument_version: "govardhan-vk6", scoring_version: "1",
      answers: Object.fromEntries(prakriti.vikriti_check.items.map((i) => [i.id, []])), result: {}, source: "app",
      completed_at: "2026-10-01T00:00:00Z",
    };
    const h = buildHistories([settled]);
    const recent = { completedAt: "2026-10-08T00:00:00Z", answers: { ...vata2 } };
    expect(todayFocus(h, now, recent)!.reason).toMatch(/check-in this week leans Vata/);
    const stale = { completedAt: "2026-09-20T00:00:00Z", answers: { ...vata2 } };
    expect(todayFocus(h, now, stale)!.reason).not.toMatch(/check-in/);
  });
});
