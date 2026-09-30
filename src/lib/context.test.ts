import { describe, expect, it } from "vitest";
import guna from "./guna.json";
import { hemisphereFromTimeZone, parseContext, seasonFor, seasonYear } from "./context";
import { buildHistories, type ResultRow } from "./results";
import { sameSeasonLastYear, timeline, trendSentence } from "./timeline";

describe("season and travel context", () => {
  it("guesses the hemisphere from the time zone, defaulting to north", () => {
    expect(hemisphereFromTimeZone("Europe/Berlin")).toBe("north");
    expect(hemisphereFromTimeZone("Australia/Sydney")).toBe("south");
    expect(hemisphereFromTimeZone("America/Argentina/Buenos_Aires")).toBe("south");
    expect(hemisphereFromTimeZone(undefined)).toBe("north");
  });

  it("names meteorological seasons, flipped for the south", () => {
    const oct = new Date("2026-10-05T00:00:00Z");
    expect(seasonFor(oct, "north")).toBe("autumn");
    expect(seasonFor(oct, "south")).toBe("spring");
    expect(seasonYear(new Date("2026-12-20T00:00:00Z"), "north")).toBe(2027); // December joins that winter
  });

  it("works the season out on the server and ignores anything else sent", () => {
    const now = new Date("2026-07-10T00:00:00Z");
    expect(parseContext({ hemisphere: "south", away: true, climate: "warmer", season: "summer" }, now)).toEqual({
      hemisphere: "south",
      season: "winter",
      away: true,
      climate: "warmer",
    });
    expect(parseContext({ hemisphere: "north", away: false, climate: "warmer" }, now)?.climate).toBeNull();
    expect(parseContext({ hemisphere: "east", away: false }, now)).toBeNull();
    expect(parseContext(undefined, now)).toBeNull();
  });
});

const gunaAnswers = (SAT: number, RAJ: number, TAM: number) =>
  Object.fromEntries(guna.items.map((i) => [i.id, { SAT, RAJ, TAM }[i.dimension as "SAT"]]));
let n = 0;
const row = (a: [number, number, number], completed_at: string, context?: object): ResultRow => ({
  id: `c${n++}`, instrument: "guna", instrument_version: "guna36-6pt", scoring_version: "2",
  answers: gunaAnswers(...a), result: {}, source: "app", completed_at, context,
});
const home = (season: string) => ({ hemisphere: "north", season, away: false, climate: null });

describe("reading results against season and travel", () => {
  it("leaves results taken away from home out of the trend, but keeps them in the chart", () => {
    const h = buildHistories([
      row([3, 3, 4], "2026-03-01T00:00:00Z", home("spring")),
      row([5, 3, 2], "2026-05-01T00:00:00Z", { hemisphere: "north", season: "spring", away: true, climate: "warmer" }),
      row([3, 3, 4], "2026-06-01T00:00:00Z", home("summer")),
    ]).guna!;
    const t = timeline(h)!;
    expect(t.away).toEqual([false, true, false]);
    expect(t.notes[1]).toBe("Spring, away from home, warmer than home");
    expect(trendSentence(t)).toBe(
      "Steady across 2 results since March 2026: no dimension has moved 5 points or more. Results taken away from home are shown but not counted.",
    );
  });

  it("compares the latest result with the same season a year earlier", () => {
    const h = buildHistories([
      row([2, 3, 5], "2025-10-10T00:00:00Z", home("autumn")),
      row([3, 3, 4], "2026-04-10T00:00:00Z", home("spring")),
      row([5, 3, 2], "2026-10-12T00:00:00Z", home("autumn")),
    ]).guna!;
    expect(sameSeasonLastYear(h)).toMatch(/^Same season in 2025 \(Autumn\): Sattva \d+% → \d+%, Rajas \d+% → \d+%, Tamas \d+% → \d+%\.$/);
    const noContext = buildHistories([row([2, 3, 5], "2025-10-10T00:00:00Z"), row([5, 3, 2], "2026-10-12T00:00:00Z")]).guna!;
    expect(sameSeasonLastYear(noContext)).toBeNull();
  });
});
