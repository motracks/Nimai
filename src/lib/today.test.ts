import { describe, expect, it } from "vitest";
import prakriti from "./prakriti.json";
import guide from "./prakriti_dosha_guide.json";
import { buildHistories, type ResultRow } from "./results";
import { doshaOfHour, todayFocus } from "./today";

let n = 0;
const row = (instrument: string, version: string, answers: unknown, context?: object): ResultRow => ({
  id: `t${n++}`, instrument, instrument_version: version, scoring_version: "2", answers, result: {}, source: "app",
  completed_at: "2026-09-25T00:00:00Z", context,
});
const constitution = (lead: "VAT" | "PIT" | "KAP") =>
  row("prakriti", "govardhan40", Object.fromEntries(prakriti.items.map((it, i) => [it.id, [i < 28 ? lead : "KAP"]])));
const vikriti = (ticks: Partial<Record<"VAT" | "PIT" | "KAP", number>>, context?: object) =>
  row("vikriti", "govardhan-vk6", Object.fromEntries(prakriti.vikriti_check.items.map((it, i) =>
    [it.id, (["VAT", "PIT", "KAP"] as const).filter((d) => i < (ticks[d] ?? 0))])), context);

const july = new Date("2026-07-15T12:00:00Z"); // northern summer: Pitta season
const october = new Date("2026-10-15T12:00:00Z"); // northern autumn: Vata season

describe("today card", () => {
  it("puts a raised Vikriti first, whatever the constitution", () => {
    const f = todayFocus(buildHistories([constitution("KAP"), vikriti({ VAT: 4 })]), july)!;
    expect(f.dosha).toBe("VAT");
    expect(f.reason).toMatch(/Vikriti check shows Vata raised/);
    expect(f.do).toEqual(guide.doshas.VAT.today.do.slice(0, 3));
    expect(f.href).toBe("/results/vikriti");
  });

  it("names the season when it matches the constitution, else follows the constitution", () => {
    expect(todayFocus(buildHistories([constitution("VAT"), vikriti({})]), october)!.reason).toMatch(/autumn, Vata's season/);
    const f = todayFocus(buildHistories([constitution("VAT")]), july)!;
    expect(f.dosha).toBe("VAT");
    expect(f.reason).toMatch(/follows your constitution/);
  });

  it("uses the southern seasons when the results were taken there", () => {
    const f = todayFocus(buildHistories([vikriti({}, { hemisphere: "south", season: "winter", away: false, climate: null })]), july)!;
    expect(f.dosha).toBe("KAP"); // July in the south is winter, when Kapha builds
  });

  it("needs a Vikriti or Prakriti result", () => {
    expect(todayFocus(buildHistories([]), july)).toBeNull();
  });

  it("maps the hour to its dosha, including after midnight", () => {
    expect(doshaOfHour(7).name).toBe("Kapha");
    expect(doshaOfHour(12).name).toBe("Pitta");
    expect(doshaOfHour(15).name).toBe("Vata");
    expect(doshaOfHour(1).name).toBe("Pitta");
    expect(doshaOfHour(4).name).toBe("Vata");
  });

  it("keeps fast breathing techniques off the card", () => {
    for (const d of ["VAT", "PIT", "KAP"] as const) expect(guide.doshas[d].today.do.map((p) => p.text).join(" ")).not.toMatch(/Kapalabhati|Bhastrika/);
  });
});
