import { describe, expect, it } from "vitest";
import bigfive from "./bigfive.json";
import ecrr from "./ecrr.json";
import guna from "./guna.json";
import prakriti from "./prakriti.json";
import resonances from "./analysis/resonances.json";
import { analyse } from "./analysis";
import { buildHistories, type ResultRow } from "./results";
import { buildProfile, buildSynthesisInput, findResonances } from "./profile";
import { INSTRUMENTS, type InstrumentKey } from "./instruments";

type Item = { id: string; dimension: string; reverse?: boolean };
const likert = (items: Item[], target: Record<string, number>) =>
  Object.fromEntries(items.map((i) => [i.id, i.reverse ? 7 - target[i.dimension] : target[i.dimension]]));
const ticks = (pick: (i: number) => string[]) =>
  Object.fromEntries(prakriti.items.map((item, i) => [item.id, pick(i)]));
const vikriti = (pick: (i: number) => string[]) =>
  Object.fromEntries(prakriti.vikriti_check.items.map((item, i) => [item.id, pick(i)]));

let n = 0;
const row = (instrument: InstrumentKey, answers: unknown, completed_at = "2026-09-25T00:00:00Z"): ResultRow => ({
  id: `r${n++}`,
  instrument,
  instrument_version: INSTRUMENTS[instrument].instrumentVersion,
  scoring_version: INSTRUMENTS[instrument].scoringVersion,
  answers,
  result: {},
  source: "app",
  completed_at,
});

// A Vata-dominant, anxious, Tamas-heavy person with a Vata Vikriti.
const person = buildHistories([
  row("bigfive", likert(bigfive.items, { EXT: 2, AGR: 5, CON: 2, NEU: 5, OPN: 6 })),
  row("ecrr", likert(ecrr.items, { ANX: 5, AVD: 2 })),
  row("guna", likert(guna.items, { SAT: 1, RAJ: 2, TAM: 6 }), "2026-09-01T00:00:00Z"),
  row("guna", likert(guna.items, { SAT: 2, RAJ: 2, TAM: 5 }), "2026-09-25T00:00:00Z"),
  row("prakriti", ticks((i) => (i < 26 ? ["VAT"] : i < 34 ? ["PIT"] : ["KAP"]))),
  row("vikriti", vikriti((i) => (i < 4 ? ["VAT"] : []))),
]);

describe("per-test analysis", () => {
  it("Big Five names the most distinctive traits and matching combinations", () => {
    const a = analyse(person.bigfive!)!;
    expect(a.headline).toBe("Most distinctive: Imaginative and Reserved");
    expect(a.sections.find((s) => s.title === "How your traits combine")?.paragraphs).toEqual(
      expect.arrayContaining([expect.stringMatching(/^You tend to process stress inwardly/)]),
    );
  });

  it("ECR-R explains the pattern and offers growth steps", () => {
    const a = analyse(person.ecrr!)!;
    expect(a.headline).toBe("Anxious-preoccupied");
    expect(a.sections.map((s) => s.title)).toEqual(["In practice", "Your two dimensions", "Ways to grow"]);
  });

  it("Guna reports the leading guna and progression since baseline", () => {
    const a = analyse(person.guna!)!;
    expect(a.headline).toBe("Tamas-dominant");
    expect(a.sections[0].title).toBe("Tamas leads");
    expect(a.progression).toMatch(/Sattva \+20.*Tamas −20/);
    expect(a.progression).toMatch(/Sattva has risen/);
  });

  it("Prakriti shows only the named dosha's guide, plus the limits", () => {
    const a = analyse(person.prakriti!)!;
    expect(a.headline).toBe("Vata-dominant");
    const titles = a.sections.map((s) => s.title);
    expect(titles).toContain("Vata: Air and Space");
    expect(titles.some((t) => t.startsWith("Pitta") || t.startsWith("Kapha"))).toBe(false);
    expect(a.caveats.some((c) => c.startsWith("It is a self-report screen"))).toBe(true);
  });

  it("Vikriti reads against Prakriti and suggests settling practice", () => {
    const a = analyse(person.vikriti!, person.prakriti!.latest.scored)!;
    expect(a.headline).toBe("Vata elevated");
    expect(a.sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(["Compared with your Prakriti", "What raises Vata", "To settle Vata"]),
    );
  });
});

describe("combined profile", () => {
  it("finds resonances and differences between frameworks", () => {
    const f = findResonances(person);
    const byId = Object.fromEntries(f.map((x) => [x.id, x.kind]));
    expect(byId.tamas_neu).toBe("resonate");
    expect(byId.tamas_con).toBe("resonate");
    expect(byId.vata_neu).toBe("resonate");
    expect(byId.vata_opn).toBe("resonate");
    expect(byId.anx_neu).toBe("resonate");
    expect(byId.vikriti_vata_neu).toBe("resonate");
  });

  it("reports a difference when frameworks disagree", () => {
    const steady = buildHistories([
      row("bigfive", likert(bigfive.items, { EXT: 3, AGR: 3, CON: 5, NEU: 1, OPN: 3 })),
      row("prakriti", ticks((i) => (i < 26 ? ["VAT"] : ["KAP"]))),
    ]);
    expect(findResonances(steady).find((x) => x.id === "vata_neu")?.kind).toBe("differ");
  });

  it("builds sections, progression and practice from what was taken", () => {
    const p = buildProfile(person, { moon_nakshatra: { name: "Rohini", pada: 2 }, moon_reliable: true, chandra_lagna: { sign: "Taurus" } }, Date.parse("2026-09-26"));
    expect(p.missing).toEqual([]);
    expect(p.sections.map((s) => s.title)).toEqual(["Your nature", "Right now", "In relationships"]);
    expect(p.sections[0].items).toEqual(["Moon nakshatra: Rohini, pada 2", "Chandra Lagna: Taurus"]);
    expect(p.progression.map((x) => x.key)).toEqual(["guna"]);
    expect(p.practice?.items?.[0]).toMatch(/^Asana to settle the Vata that is raised now/);
  });

  it("works with a single test and lists the rest as missing", () => {
    const p = buildProfile(buildHistories([row("guna", likert(guna.items, { SAT: 5, RAJ: 3, TAM: 2 }))]), null);
    expect(p.taken).toEqual(["guna"]);
    expect(p.resonances).toEqual([]);
    expect(p.sections.map((s) => s.title)).toEqual(["Right now"]);
  });

  it("produces a versioned synthesis input", () => {
    const input = buildSynthesisInput(person, null);
    expect(input.version).toBe("1");
    expect(Object.keys(input.instruments).sort()).toEqual(["bigfive", "ecrr", "guna", "prakriti", "vikriti"]);
    expect(input.instruments.guna.baseline?.completed_at).toBe("2026-09-01T00:00:00Z");
  });

  it("resonance rules reference real instruments and dimensions", () => {
    for (const r of resonances.rules) {
      for (const side of [r.anchor, r.other]) {
        expect(Object.keys(INSTRUMENTS)).toContain(side.instrument);
      }
      expect(["high", "low"]).toContain(r.other.expect);
    }
  });
});
