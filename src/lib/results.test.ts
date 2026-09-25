import { describe, expect, it } from "vitest";
import guna from "./guna.json";
import prakriti from "./prakriti.json";
import { buildHistories, vikritiVsPrakriti, type ResultRow } from "./results";
import { scorePrakriti, scoreVikriti } from "./scoring";

const gunaAnswers = (SAT: number, RAJ: number, TAM: number) =>
  Object.fromEntries(guna.items.map((i) => [i.id, { SAT, RAJ, TAM }[i.dimension as "SAT"]]));

const row = (over: Partial<ResultRow>): ResultRow => ({
  id: Math.random().toString(36),
  instrument: "guna",
  instrument_version: "guna36-6pt",
  scoring_version: "2",
  answers: {},
  result: {},
  source: "app",
  completed_at: "2026-09-25T00:00:00Z",
  ...over,
});

describe("buildHistories", () => {
  it("uses the first result as baseline and re-scores both with current rules", () => {
    const h = buildHistories([
      row({ answers: gunaAnswers(5, 3, 2), completed_at: "2026-10-25T00:00:00Z" }),
      // Legacy backfill row with the old stored pattern: re-scored, not trusted.
      row({
        answers: gunaAnswers(4, 4, 4),
        scoring_version: "1",
        source: "legacy_backfill",
        result: { legacy: { pattern: "old label" } },
        completed_at: "2026-09-22T00:00:00Z",
      }),
    ]).guna!;
    expect(h.count).toBe(2);
    expect(h.baseline?.scored?.classification.label).toBe("Balanced / fluid");
    expect(h.latest.scored?.classification.label).toBe("Sattva-dominant");
    expect(h.delta).toEqual({ SAT: 20, RAJ: -20, TAM: -40 });
  });

  it("keeps an older item set as a non-comparable baseline", () => {
    const v2 = Object.fromEntries(prakriti.items.map((i) => [i.id, ["VAT"]]));
    const h = buildHistories([
      row({
        instrument: "prakriti",
        instrument_version: "prakriti-older-version",
        answers: { P01: "Thin, light, hard to gain weight" },
        result: { legacy: { pattern: "Vata-leaning", scores: { VAT: 50, PIT: 30, KAP: 20 } } },
        completed_at: "2026-09-21T00:00:00Z",
      }),
      row({ instrument: "prakriti", instrument_version: "govardhan40", answers: v2 }),
    ]).prakriti!;
    expect(h.baseline?.comparable).toBe(false);
    expect(h.baseline?.legacy?.label).toBe("Vata-leaning");
    expect(h.delta).toBeNull();
    expect(h.latest.scored?.classification.label).toBe("Vata-dominant");
  });

  it("has no baseline with a single result", () => {
    const h = buildHistories([row({ answers: gunaAnswers(5, 3, 2) })]).guna!;
    expect(h.baseline).toBeNull();
    expect(h.delta).toBeNull();
  });
});

describe("vikritiVsPrakriti", () => {
  const vata = scorePrakriti(Object.fromEntries(prakriti.items.map((i) => [i.id, ["VAT"]])));
  const ids = prakriti.vikriti_check.items.map((i) => i.id);
  it("recognises the leading dosha being raised", () => {
    const vk = scoreVikriti(Object.fromEntries(ids.map((id, n) => [id, n < 3 ? ["VAT"] : []])));
    expect(vikritiVsPrakriti(vk, vata)).toMatch(/leading dosha \(Vata\) is the one currently raised/);
  });
  it("recognises a different dosha being raised", () => {
    const vk = scoreVikriti(Object.fromEntries(ids.map((id, n) => [id, n < 3 ? ["KAP"] : []])));
    expect(vikritiVsPrakriti(vk, vata)).toMatch(/differs from your leading dosha/);
  });
});
