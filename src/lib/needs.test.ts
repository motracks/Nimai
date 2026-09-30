import { describe, expect, it } from "vitest";
import bigfive from "./bigfive.json";
import ecrr from "./ecrr.json";
import guna from "./guna.json";
import prakriti from "./prakriti.json";
import { INSTRUMENTS, type InstrumentKey } from "./instruments";
import { needs } from "./needs";
import { acceptableDay } from "./practices";
import { lastDays, practiceCounts, practicePatterns } from "./practice-patterns";
import { buildHistories, type ResultRow } from "./results";

type Item = { id: string; dimension: string; reverse?: boolean };
const likert = (items: Item[], target: Record<string, number>) =>
  Object.fromEntries(items.map((i) => [i.id, i.reverse ? 7 - target[i.dimension] : target[i.dimension]]));
const vk = (ticks: Partial<Record<"VAT" | "PIT" | "KAP", number>>) =>
  Object.fromEntries(prakriti.vikriti_check.items.map((it, i) => [it.id, (["VAT", "PIT", "KAP"] as const).filter((d) => i < (ticks[d] ?? 0))]));

let n = 0;
const row = (instrument: InstrumentKey, answers: unknown, completed_at = "2026-09-25T00:00:00Z"): ResultRow => ({
  id: `n${n++}`, instrument, instrument_version: INSTRUMENTS[instrument].instrumentVersion,
  scoring_version: INSTRUMENTS[instrument].scoringVersion, answers, result: {}, source: "app", completed_at,
});
const vataPrakriti = row("prakriti", Object.fromEntries(prakriti.items.map((it, i) => [it.id, [i < 28 ? "VAT" : "KAP"]])));
const oct1 = new Date("2026-10-01T12:00:00Z"); // northern autumn: Vata season

describe("needs model", () => {
  it("ranks current state above temperament and nature, top four only", () => {
    const h = buildHistories([
      vataPrakriti,
      row("vikriti", vk({ PIT: 4 })),
      row("guna", likert(guna.items, { SAT: 2, RAJ: 2, TAM: 6 })),
      row("bigfive", likert(bigfive.items, { EXT: 3, AGR: 4, CON: 4, NEU: 6, OPN: 4 })),
      row("ecrr", likert(ecrr.items, { ANX: 6, AVD: 2 })),
    ]);
    const list = needs(h, oct1);
    expect(list).toHaveLength(4);
    expect(list[0]).toMatchObject({ layer: "current state", title: "Settle Pitta", confidence: "high" });
    expect(list[1]).toMatchObject({ layer: "current state", title: "Build momentum" });
    expect(list.map((x) => x.layer)).not.toContain("nature");
  });

  it("folds the constitution into the season when they match", () => {
    const list = needs(buildHistories([vataPrakriti]), oct1);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ layer: "season", title: "Autumn: keep Vata in check", confidence: "medium" });
  });

  it("lowers confidence for an old state result and ignores a stale check-in", () => {
    const h = buildHistories([row("vikriti", vk({ KAP: 4 }), "2026-07-01T00:00:00Z")]);
    const checkin = { completedAt: "2026-09-01T00:00:00Z", answers: { sleep: "VAT", digestion: "VAT", mood: "VAT", energy: "ok" } as const };
    const list = needs(h, oct1, checkin);
    expect(list[0]).toMatchObject({ title: "Settle Kapha", confidence: "medium" });
    expect(list.some((x) => x.layer === "check-in")).toBe(false);
  });

  it("uses a fresh check-in lean when nothing is raised", () => {
    const checkin = { completedAt: "2026-09-29T00:00:00Z", answers: { sleep: "PIT", digestion: "PIT", mood: "PIT", energy: "ok" } as const };
    const list = needs(buildHistories([row("vikriti", vk({}))]), oct1, checkin);
    expect(list[0]).toMatchObject({ layer: "check-in", title: "Watch Pitta", confidence: "medium" });
  });
});

describe("practice log", () => {
  it("accepts only a local date within a day of now", () => {
    expect(acceptableDay("2026-10-01", oct1)).toBe(true);
    expect(acceptableDay("2026-09-30", oct1)).toBe(true);
    expect(acceptableDay("2026-09-28", oct1)).toBe(false);
    expect(acceptableDay("yesterday", oct1)).toBe(false);
  });

  it("counts days per practice over a window", () => {
    const log = [
      { practice: "vat-warm-food", done_on: "2026-09-29" },
      { practice: "vat-warm-food", done_on: "2026-09-30" },
      { practice: "pit-keep-cool", done_on: "2026-08-01" },
      { practice: "unknown", done_on: "2026-09-30" },
    ];
    const recent = practiceCounts(lastDays(log, 28, oct1.getTime()));
    expect(recent).toEqual([{ id: "vat-warm-food", text: expect.any(String), dosha: "Vata", days: 2 }]);
  });

  it("describes what a raised dosha did alongside logged practice, as a pattern", () => {
    const h = buildHistories([
      row("vikriti", vk({ VAT: 4 }), "2026-08-01T00:00:00Z"),
      row("vikriti", vk({ VAT: 2 }), "2026-09-15T00:00:00Z"),
      row("vikriti", vk({ VAT: 3 }), "2026-09-30T00:00:00Z"),
    ]);
    const log = [
      { practice: "vat-warm-food", done_on: "2026-08-05" },
      { practice: "vat-stay-warm", done_on: "2026-08-05" },
      { practice: "vat-warm-food", done_on: "2026-08-10" },
      { practice: "pit-keep-cool", done_on: "2026-08-12" },
      { practice: "vat-warm-food", done_on: "2026-08-01" }, // same day as the first check: not between
    ];
    const p = practicePatterns(h.vikriti, log);
    expect(p).toHaveLength(1); // Vata was 2 at the second check, below the attention line
    expect(p[0]).toMatch(/Vata practices on 2 days, and Vata eased from 4 to 2 of 6/);
  });
});
