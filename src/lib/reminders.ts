import { INSTRUMENTS, INSTRUMENT_KEYS, type InstrumentKey } from "@/lib/instruments";

const DAY_MS = 24 * 60 * 60 * 1000;

// Equinoxes and solstices move by about a day between years; the reminders are
// a nudge, not an almanac, so fixed dates are close enough. They are the same
// moments in both hemispheres, only the season names swap.
const SEASON_CHANGES: [month: number, day: number][] = [
  [2, 20],
  [5, 21],
  [8, 22],
  [11, 21],
];

// Svoboda (Ayurveda: Life, Health and Longevity, ch.4): imbalance arises most at
// the junctions of the seasons. A Vikriti check within two weeks either side
// catches it early.
export const SEASON_WINDOW_DAYS = 14;

export function seasonChangesAround(now: number, count = 4): Date[] {
  const year = new Date(now).getUTCFullYear();
  const all = [year - 1, year, year + 1].flatMap((y) => SEASON_CHANGES.map(([m, d]) => Date.UTC(y, m, d)));
  return all
    .filter((t) => t >= now - SEASON_WINDOW_DAYS * DAY_MS)
    .slice(0, count)
    .map((t) => new Date(t));
}

export type Reminder =
  | { kind: "retake_due"; instrument: InstrumentKey; since: Date }
  | { kind: "season_check"; seasonChange: Date }
  | { kind: "upcoming"; instrument: InstrumentKey; on: Date };

export type LatestAt = Partial<Record<InstrumentKey, string>>;

export function buildReminders(latestAt: LatestAt, now = Date.now()): Reminder[] {
  const due: Reminder[] = [];
  const upcoming: Reminder[] = [];
  for (const key of INSTRUMENT_KEYS) {
    const at = latestAt[key];
    if (!at) continue;
    const next = new Date(at).getTime() + INSTRUMENTS[key].suggestedRetakeDays * DAY_MS;
    if (next <= now) due.push({ kind: "retake_due", instrument: key, since: new Date(next) });
    else if (next - now <= 30 * DAY_MS) upcoming.push({ kind: "upcoming", instrument: key, on: new Date(next) });
  }

  const [change] = seasonChangesAround(now, 1);
  const inWindow = Math.abs(change.getTime() - now) <= SEASON_WINDOW_DAYS * DAY_MS;
  const vikriti = latestAt.vikriti ? new Date(latestAt.vikriti).getTime() : null;
  const checkedThisJunction = vikriti != null && vikriti >= change.getTime() - SEASON_WINDOW_DAYS * DAY_MS;
  const season: Reminder[] =
    inWindow && !checkedThisJunction && !due.some((r) => r.kind === "retake_due" && r.instrument === "vikriti")
      ? [{ kind: "season_check", seasonChange: change }]
      : [];

  return [...due, ...season, ...upcoming.sort((a, b) => ("on" in a && "on" in b ? a.on.getTime() - b.on.getTime() : 0))];
}

export interface CalendarEvent {
  uid: string;
  date: Date;
  summary: string;
  description: string;
  url: string;
}

export function calendarEvents(latestAt: LatestAt, origin: string, now = Date.now()): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const key of INSTRUMENT_KEYS) {
    const at = latestAt[key];
    if (!at) continue;
    const meta = INSTRUMENTS[key];
    const next = Math.max(new Date(at).getTime() + meta.suggestedRetakeDays * DAY_MS, now);
    events.push({
      uid: `retake-${key}-${new Date(next).toISOString().slice(0, 10)}@nimai`,
      date: new Date(next),
      summary: `Nimai: retake ${meta.label}`,
      description: `The suggested gap since your last ${meta.label} result has passed.`,
      url: `${origin}${meta.testHref}`,
    });
  }
  for (const change of seasonChangesAround(now, 4)) {
    if (change.getTime() < now) continue;
    events.push({
      uid: `season-${change.toISOString().slice(0, 10)}@nimai`,
      date: change,
      summary: "Nimai: season change, check your Vikriti",
      description:
        "Imbalance tends to arise when the season turns (Svoboda, Ayurveda: Life, Health and Longevity, ch.4). A short Vikriti check around now catches it early.",
      url: `${origin}/vikriti`,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// RFC 5545: CRLF line ends, lines folded at 75 octets, text escaped.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74;
    if (new TextEncoder().encode(chunk + ch).length > limit) {
      out.push(chunk);
      chunk = ch;
    } else chunk += ch;
  }
  out.push(chunk);
  return out.join("\r\n ");
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function toICS(events: CalendarEvent[], now = Date.now()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nimai//Reminders//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Nimai"];
  for (const e of events) {
    const end = new Date(e.date.getTime() + DAY_MS);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(new Date(now))}`,
      `DTSTART;VALUE=DATE:${day(e.date)}`,
      `DTEND;VALUE=DATE:${day(end)}`,
      `SUMMARY:${esc(e.summary)}`,
      `DESCRIPTION:${esc(`${e.description}\n${e.url}`)}`,
      `URL:${e.url}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.summary)}`,
      "TRIGGER:PT9H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
