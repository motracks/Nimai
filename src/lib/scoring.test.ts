import { describe, expect, it } from "vitest";
import bigfive from "./bigfive.json";
import ecrr from "./ecrr.json";
import guna from "./guna.json";
import prakriti from "./prakriti.json";
import gunaMapping from "./guna_mapping.json";
import prakritiMapping from "./prakriti_mapping.json";
import vikritiMapping from "./vikriti_mapping.json";
import {
  AnswerError,
  scoreBigFive,
  scoreEcrr,
  scoreGuna,
  scorePrakriti,
  scoreVikriti,
} from "./scoring";

type Item = { id: string; dimension: string; reverse?: boolean };

// Answers where every dimension's *scored* value (after reverse keying) equals
// the given target, so expected means are known exactly.
function likertFor(items: Item[], target: Record<string, number>) {
  return Object.fromEntries(
    items.map((i) => [i.id, i.reverse ? 7 - target[i.dimension] : target[i.dimension]]),
  );
}

// Same, but with a fractional per-dimension mean: `n` items of the dimension
// get `hi`, the rest get `lo` (scored values).
function likertMix(items: Item[], spec: Record<string, { hi: number; lo: number; n: number }>) {
  const seen: Record<string, number> = {};
  return Object.fromEntries(
    items.map((i) => {
      const s = spec[i.dimension];
      seen[i.dimension] = (seen[i.dimension] ?? 0) + 1;
      const v = seen[i.dimension] <= s.n ? s.hi : s.lo;
      return [i.id, i.reverse ? 7 - v : v];
    }),
  );
}

function prakritiTicks(pick: (index: number) => ("VAT" | "PIT" | "KAP")[]) {
  return Object.fromEntries(prakriti.items.map((item, idx) => [item.id, pick(idx)]));
}

describe("Big Five", () => {
  it("scores reverse items as 7 - x and maps bands", () => {
    const r = scoreBigFive(likertFor(bigfive.items, { EXT: 6, AGR: 1, CON: 4, NEU: 3, OPN: 5 }));
    expect(r.raw).toEqual({ EXT: 6, AGR: 1, CON: 4, NEU: 3, OPN: 5 });
    expect(r.norm).toEqual({ EXT: 100, AGR: 0, CON: 60, NEU: 40, OPN: 80 });
    expect(r.classification.dimensionLabels).toEqual({
      EXT: "Outgoing",
      AGR: "Direct",
      CON: "Adaptive planner",
      NEU: "Responsive",
      OPN: "Imaginative",
    });
  });

  it("has no gaps between bands", () => {
    // 2.9 is the lowest mean above the 2.88 edge that 10 items can produce.
    const r = scoreBigFive(likertMix(bigfive.items, {
      EXT: { hi: 3, lo: 2, n: 9 }, AGR: { hi: 3, lo: 3, n: 0 }, CON: { hi: 3, lo: 3, n: 0 },
      NEU: { hi: 3, lo: 3, n: 0 }, OPN: { hi: 3, lo: 3, n: 0 },
    }));
    expect(r.raw.EXT).toBe(2.9);
    expect(r.classification.dimensionLabels?.EXT).toBe("Situationally social");
  });

  it("flags straight-lining and acquiescence", () => {
    const allSix = Object.fromEntries(bigfive.items.map((i) => [i.id, 6]));
    const r = scoreBigFive(allSix);
    expect(r.quality.flags).toContain("straightline");
    expect(r.quality.flags).toContain("acquiescence");
  });

  it("does not flag a consistent responder", () => {
    const r = scoreBigFive(likertFor(bigfive.items, { EXT: 5, AGR: 2, CON: 4, NEU: 3, OPN: 6 }));
    expect(r.quality.flags).toEqual([]);
  });

  it("rejects incomplete, out-of-range and unknown answers", () => {
    const ok = likertFor(bigfive.items, { EXT: 3, AGR: 3, CON: 3, NEU: 3, OPN: 3 });
    const missing: Record<string, number> = { ...ok };
    delete missing.BF01;
    expect(() => scoreBigFive(missing)).toThrow(AnswerError);
    expect(() => scoreBigFive({ ...ok, BF01: 7 })).toThrow(AnswerError);
    expect(() => scoreBigFive({ ...ok, BF01: 2.5 })).toThrow(AnswerError);
    expect(() => scoreBigFive({ ...ok, XX: 1 })).toThrow(AnswerError);
    expect(() => scoreBigFive([1, 2])).toThrow(AnswerError);
  });
});

describe("ECR-R", () => {
  it("uses 3.5 as the quadrant cutoff (1-7 midpoint rescaled)", () => {
    const r = scoreEcrr(likertFor(ecrr.items, { ANX: 4, AVD: 3 }));
    expect(r.raw).toEqual({ ANX: 4, AVD: 3 });
    expect(r.classification.label).toBe("Anxious-preoccupied");
    expect(r.classification.margin).toBe(0.5);
  });

  it("covers all four quadrants", () => {
    const label = (ANX: number, AVD: number) => scoreEcrr(likertFor(ecrr.items, { ANX, AVD })).classification.label;
    expect(label(2, 2)).toBe("Secure");
    expect(label(5, 2)).toBe("Anxious-preoccupied");
    expect(label(2, 5)).toBe("Dismissive-avoidant");
    expect(label(5, 5)).toBe("Fearful-avoidant");
  });

  it("treats a mean exactly at the cutoff as low and flags it", () => {
    // 9 items at 4 and 9 at 3 -> mean 3.5
    const r = scoreEcrr(likertMix(ecrr.items, { ANX: { hi: 4, lo: 3, n: 9 }, AVD: { hi: 2, lo: 2, n: 0 } }));
    expect(r.raw.ANX).toBe(3.5);
    expect(r.classification.label).toBe("Secure");
    expect(r.quality.flags).toContain("near_boundary");
  });
});

describe("Guna", () => {
  const gunaAt = (SAT: number, RAJ: number, TAM: number) => scoreGuna(likertFor(guna.items, { SAT, RAJ, TAM }));

  it("computes shares above the scale floor, summing to 100", () => {
    const r = gunaAt(5, 3, 2);
    expect(r.shares).toEqual({ SAT: 57.14, RAJ: 28.57, TAM: 14.29 });
    expect(r.raw).toEqual({ SAT: 5, RAJ: 3, TAM: 2 });
    expect(r.norm).toEqual({ SAT: 80, RAJ: 40, TAM: 20 });
  });

  it("calls a clear single lead dominant", () => {
    expect(gunaAt(5, 3, 2).classification.label).toBe("Sattva-dominant");
  });

  it("calls two strong gunas a blend even when the top one is above 45%", () => {
    // Old rule labelled this Sattva-dominant.
    const r = scoreGuna(likertMix(guna.items, {
      SAT: { hi: 6, lo: 5, n: 6 }, RAJ: { hi: 5, lo: 5, n: 0 }, TAM: { hi: 1, lo: 1, n: 0 },
    }));
    expect(r.raw).toEqual({ SAT: 5.5, RAJ: 5, TAM: 1 });
    expect(r.classification.label).toBe("Sattva-Rajas blend");
  });

  it("recognises a balanced profile", () => {
    expect(gunaAt(4, 4, 4).classification.label).toBe("Balanced / fluid");
    // All answers 1 -> nothing above floor; treated as balanced, flagged as straight-lined.
    const r = gunaAt(1, 1, 1);
    expect(r.classification.label).toBe("Balanced / fluid");
    expect(r.quality.flags).toContain("straightline");
  });

  it("falls back to leaning", () => {
    // shares 3.5/2.5/2 over 8 -> 43.75 / 31.25 / 25
    const r = scoreGuna(likertMix(guna.items, {
      SAT: { hi: 5, lo: 4, n: 6 }, RAJ: { hi: 4, lo: 3, n: 6 }, TAM: { hi: 3, lo: 3, n: 0 },
    }));
    expect(r.classification.key).toBe("leaning");
    expect(r.classification.label).toBe("Sattva-leaning");
  });
});

describe("Prakriti", () => {
  it("gives 2 points per single tick and 1+1 for a double, out of 80", () => {
    const r = scorePrakriti(prakritiTicks((i) => (i < 20 ? ["VAT"] : i < 30 ? ["PIT"] : ["PIT", "KAP"])));
    expect(r.raw).toEqual({ VAT: 40, PIT: 30, KAP: 10 });
    expect(r.shares).toEqual({ VAT: 50, PIT: 37.5, KAP: 12.5 });
    expect(Object.values(r.shares!).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it("applies Sama -> Ekadoshaja -> Dvandvaja in order", () => {
    const pick = (v: number, p: number) => (i: number) =>
      (i < v ? ["VAT"] : i < v + p ? ["PIT"] : ["KAP"]) as ("VAT" | "PIT" | "KAP")[];
    expect(scorePrakriti(prakritiTicks(pick(14, 13))).classification.label).toBe("Sama (Tridoshaja)");
    expect(scorePrakriti(prakritiTicks(pick(24, 8))).classification.label).toBe("Vata-dominant");
    expect(scorePrakriti(prakritiTicks(pick(18, 16))).classification.label).toBe("Vata-Pitta (dual)");
  });

  it("flags results near a rule boundary and Sama for re-check", () => {
    // 20 / 14 / 6 items -> 50 / 35 / 15 %: lead 15 exactly -> dominant, margin 0
    const r = scorePrakriti(prakritiTicks((i) => (i < 20 ? ["VAT"] : i < 34 ? ["PIT"] : ["KAP"])));
    expect(r.classification.key).toBe("ekadosha");
    expect(r.classification.margin).toBe(0);
    expect(r.quality.flags).toContain("near_boundary");
    const sama = scorePrakriti(prakritiTicks((i) => (i < 14 ? ["VAT"] : i < 27 ? ["PIT"] : ["KAP"])));
    expect(sama.quality.flags).toContain("recheck_sama");
  });

  it("flags heavy use of double ticks", () => {
    const r = scorePrakriti(prakritiTicks((i) => (i < 15 ? ["VAT", "PIT"] : ["KAP"])));
    expect(r.quality.flags).toContain("many_double_ticks");
  });

  it("rejects the legacy v1 answer shape and invalid ticks", () => {
    const v1 = Object.fromEntries(prakriti.items.map((i) => [i.id, i.options[0].text]));
    expect(() => scorePrakriti(v1)).toThrow(AnswerError);
    const ok = prakritiTicks(() => ["VAT"]);
    expect(() => scorePrakriti({ ...ok, P01: [] })).toThrow(AnswerError);
    expect(() => scorePrakriti({ ...ok, P01: ["VAT", "PIT", "KAP"] })).toThrow(AnswerError);
    expect(() => scorePrakriti({ ...ok, P01: ["VAT", "VAT"] })).toThrow(AnswerError);
  });
});

describe("Vikriti", () => {
  const vk = prakriti.vikriti_check.items;

  it("counts ticks per column and allows unticked items", () => {
    const r = scoreVikriti({ VK1: ["VAT"], VK2: ["VAT", "PIT"], VK3: [] });
    expect(r.raw).toEqual({ VAT: 2, PIT: 1, KAP: 0 });
    expect(r.classification.key).toBe("settled");
  });

  it("marks columns with 3+ ticks and refers at 4+ in two columns", () => {
    const three = Object.fromEntries(vk.map((i, idx) => [i.id, idx < 3 ? ["PIT"] : []]));
    expect(scoreVikriti(three).classification.label).toBe("Pitta elevated");
    const heavy = Object.fromEntries(vk.map((i, idx) => [i.id, idx < 4 ? ["VAT", "KAP"] : []]));
    const r = scoreVikriti(heavy);
    expect(r.classification.key).toBe("referral");
    expect(r.quality.flags).toContain("referral");
  });
});

describe("mapping files", () => {
  it("define every pattern key the scorers can emit", () => {
    const keys = (ps: { key: string }[]) => ps.map((p) => p.key).sort();
    expect(keys(gunaMapping.dominance_patterns)).toEqual(["balanced", "blend", "dominant", "leaning"]);
    expect(keys(prakritiMapping.dominance_patterns)).toEqual(["dvandva", "ekadosha", "sama"]);
    expect(keys(vikritiMapping.patterns)).toEqual(["elevated", "referral", "settled"]);
  });

  it("section max points add up to 80", () => {
    expect(prakriti.sections.reduce((a, s) => a + s.max_points, 0)).toBe(80);
    expect(prakriti.sections.reduce((a, s) => a + s.items, 0)).toBe(prakriti.items.length);
  });
});
