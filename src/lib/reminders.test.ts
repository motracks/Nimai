import { describe, expect, it } from "vitest";
import { buildReminders, calendarEvents, seasonChangesAround, toICS } from "./reminders";

const at = (iso: string) => Date.parse(iso);
const DAY = 24 * 60 * 60 * 1000;

describe("reminders", () => {
  it("lists due retakes, then upcoming ones within 30 days", () => {
    const now = at("2026-11-01T12:00:00Z"); // outside any season-change window
    const r = buildReminders(
      { guna: "2026-08-01T00:00:00Z", bigfive: "2026-05-20T00:00:00Z", prakriti: "2026-09-01T00:00:00Z" },
      now,
    );
    expect(r.map((x) => [x.kind, "instrument" in x ? x.instrument : null])).toEqual([
      ["retake_due", "guna"],
      ["upcoming", "bigfive"],
    ]);
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
  it("renders due items, the season prompt and the calendar link", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: RemindersCard } = await import("@/components/RemindersCard");
    const html = renderToStaticMarkup(
      createElement(RemindersCard, { reminders: buildReminders({ guna: "2026-08-01T00:00:00Z" }, at("2026-09-15T12:00:00Z")) }),
    );
    expect(html).toContain("Guna (Sattva/Rajas/Tamas): time for a retake");
    expect(html).toContain("The season turns around 22 September");
    expect(html).toContain('href="/reminders.ics"');
    const empty = renderToStaticMarkup(createElement(RemindersCard, { reminders: [] }));
    expect(empty).toContain("Nothing due right now.");
  });
});
