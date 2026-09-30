import { describe, expect, it } from "vitest";
import guna from "./guna.json";
import prakriti from "./prakriti.json";
import { buildHistories, type ResultRow } from "./results";
import { SERIES_COLORS, timeline, trendSentence } from "./timeline";

const gunaAnswers = (SAT: number, RAJ: number, TAM: number) =>
  Object.fromEntries(guna.items.map((i) => [i.id, { SAT, RAJ, TAM }[i.dimension as "SAT"]]));
const vikritiAnswers = (vata: number) =>
  Object.fromEntries(prakriti.vikriti_check.items.map((item, i) => [item.id, i < vata ? ["VAT"] : []]));

let n = 0;
const row = (instrument: string, answers: unknown, completed_at: string, instrument_version = "guna36-6pt"): ResultRow => ({
  id: `r${n++}`, instrument, instrument_version, scoring_version: "2", answers, result: {}, source: "app", completed_at,
});

describe("progress timeline", () => {
  it("needs at least two comparable results", () => {
    const h = buildHistories([row("guna", gunaAnswers(5, 3, 2), "2026-06-01T00:00:00Z")]).guna!;
    expect(timeline(h)).toBeNull();
  });

  it("plots Guna as shares, in a fixed order and colour per dimension", () => {
    const h = buildHistories([
      row("guna", gunaAnswers(2, 3, 5), "2026-06-01T00:00:00Z"),
      row("guna", gunaAnswers(3, 3, 4), "2026-07-01T00:00:00Z"),
      row("guna", gunaAnswers(5, 3, 2), "2026-09-01T00:00:00Z"),
    ]).guna!;
    const t = timeline(h)!;
    expect(t.measure).toBe("share");
    expect(t.series.map((s) => [s.dim, s.color])).toEqual([
      ["SAT", SERIES_COLORS[0]],
      ["RAJ", SERIES_COLORS[1]],
      ["TAM", SERIES_COLORS[2]],
    ]);
    for (let i = 0; i < 3; i++) {
      const total = t.series.reduce((sum, s) => sum + s.values[i], 0);
      expect(Math.abs(total - 100)).toBeLessThanOrEqual(1);
    }
    expect(trendSentence(t)).toMatch(/^Sattva has risen \d+ points since June 2026, across 3 results; Tamas has come down \d+\.$/);
  });

  it("reports steady when nothing moved five points", () => {
    const h = buildHistories([
      row("vikriti", vikritiAnswers(2), "2026-06-01T00:00:00Z", "govardhan-vk6"),
      row("vikriti", vikritiAnswers(2), "2026-07-01T00:00:00Z", "govardhan-vk6"),
    ]).vikriti!;
    expect(trendSentence(timeline(h)!)).toBe("Steady across 2 results since June 2026: no dimension has moved 5 points or more.");
  });
});
