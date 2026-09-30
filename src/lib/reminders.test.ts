import { describe, expect, it } from "vitest";
import { buildReminders, calendarEvents, seasonChangesAround, splitReminders, toICS } from "./reminders";

const at = (iso: string) => Date.parse(iso);
const DAY = 24 * 60 * 60 * 1000;

describe("reminders", () => {
  it("lists due retakes, then upcoming ones by date", () => {
    const now = at("2026-11-01T12:00:00Z"); // outside any season-change window
    const r = buildReminders(
      { guna: "2026-08-01T00:00:00Z", bigfive: "2026-05-20T00:00:00Z", prakriti: "2026-09-01T00:00:00Z" },
      now,
    );
    expect(r.map((x) => [x.kind, "instrument" in x ? x.instrument : null])).toEqual([
      ["retake_due", "guna"],
      ["upcoming", "bigfive"],
      ["upcoming", "prakriti"],
    ]);
  });

  it("puts only due or within-5-days reminders at the top", () => {
    const now = at("2026-11-01T12:00:00Z");
    const r = buildReminders(
      // guna due; bigfive about 2 weeks away; vikriti 4 days away
      { guna: "2026-08-01T00:00:00Z", bigfive: "2026-05-20T00:00:00Z", vikriti: "2026-10-06T00:00:00Z" },
      now,
    );
    const { top, bottom } = splitReminders(r, now);
    expect(top.map((x) => ("instrument" in x ? x.instrument : x.kind))).toEqual(["guna", "vikriti"]);
    expect(bottom.map((x) => ("instrument" in x ? x.instrument : x.kind))).toEqual(["bigfive"]);
  });

  it("moves the season prompt to the top only from 5 days before the change", () => {
    const early = at("2026-09-12T12:00:00Z"); // 10 days before
    expect(splitReminders(buildReminders({}, early), early).top).toEqual([]);
    const close = at("2026-09-18T12:00:00Z"); // 4 days before
    expect(splitReminders(buildReminders({}, close), close).top.map((x) => x.kind)).toEqual(["season_check"]);
    const after = at("2026-09-30T12:00:00Z"); // after the change, still in the window
    expect(splitReminders(buildReminders({}, after), after).top.map((x) => x.kind)).toEqual(["season_check"]);
  });

  it("prompts a Vikriti check within two weeks of a season change, unless one was already taken", () => {
    const now = at("2026-09-15T12:00:00Z"); // a week before the September equinox
    expect(buildReminders({}, now)).toEqual([{ kind: "season_check", seasonChange: new Date(Date.UTC(2026, 8, 22)) }]);
    const seasonal = (r: ReturnType<typeof buildReminders>) => r.filter((x) => x.kind === "season_check");
    expect(seasonal(buildReminders({ vikriti: "2026-09-10T00:00:00Z" }, now))).toEqual([]);
    expect(buildReminders({}, at("2026-10-20T12:00:00Z"))).toEqual([]);
  });

  it("finds the next four season changes across the year boundary", () => {
    const d = seasonChangesAround(at("2026-12-30T00:00:00Z")).map((x) => x.toISOString().slice(0, 10));
    expect(d).toEqual(["2026-12-21", "2027-03-20", "2027-06-21", "2027-09-22"]);
  });

  it("writes a valid calendar file", () => {
    const now = at("2026-10-01T12:00:00Z");
    const ics = toICS(calendarEvents({ guna: "2026-09-20T00:00:00Z" }, "https://nimai.example", now), now);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261020"); // guna: 30 days after 20 Sept
    expect(ics).toContain("SUMMARY:Nimai: season change\\, check your Vikriti");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4); // 1 retake + 3 season changes still ahead
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(now + 19 * DAY).toBeLessThan(at("2026-10-21T00:00:00Z"));
  });
});

describe("RemindersCard", () => {
  it("renders the top card only when something is close, and the calendar link at the bottom", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: RemindersCard, ComingUp } = await import("@/components/RemindersCard");
    const html = renderToStaticMarkup(
      createElement(RemindersCard, { reminders: buildReminders({ guna: "2026-08-01T00:00:00Z" }, at("2026-09-15T12:00:00Z")) }),
    );
    expect(html).toContain("Guna (Sattva/Rajas/Tamas): time for a retake");
    expect(html).toContain("The season turns around 22 September");
    expect(renderToStaticMarkup(createElement(RemindersCard, { reminders: [] }))).toBe("");
    const bottom = renderToStaticMarkup(createElement(ComingUp, { reminders: [] }));
    expect(bottom).toContain("Nothing scheduled.");
    expect(bottom).toContain('href="/reminders.ics"');
  });
});
