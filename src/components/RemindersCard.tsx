import Link from "next/link";
import { INSTRUMENTS } from "@/lib/instruments";
import type { Reminder } from "@/lib/reminders";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

function line(r: Reminder): { text: string; href: string; strong: boolean } {
  switch (r.kind) {
    case "retake_due":
      return { text: `${INSTRUMENTS[r.instrument].label}: time for a retake`, href: INSTRUMENTS[r.instrument].testHref, strong: true };
    case "season_check":
      return {
        text: `The season turns around ${fmt(r.seasonChange)}. Imbalance tends to arise at the change, so it's a good time for a Vikriti check.`,
        href: "/vikriti",
        strong: true,
      };
    case "upcoming":
      return { text: `${INSTRUMENTS[r.instrument].label}: next retake around ${fmt(r.on)}`, href: `/results/${r.instrument}`, strong: false };
  }
}

export default function RemindersCard({ reminders }: { reminders: Reminder[] }) {
  return (
    <section className="vn-card mb-6" aria-labelledby="reminders-heading">
      <h2 id="reminders-heading" className="text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
        Reminders
      </h2>
      {reminders.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
          Nothing due right now.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed">
          {reminders.map((r) => {
            const l = line(r);
            return (
              <li key={`${r.kind}-${"instrument" in r ? r.instrument : "season"}`}>
                <Link href={l.href} className="no-underline" style={{ color: l.strong ? "var(--ink)" : "var(--ink-mid)" }}>
                  {l.text} →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs" style={{ color: "var(--ink-dim)" }}>
        <a href="/reminders.ics" className="vn-link">
          Add these to your calendar
        </a>{" "}
        (retake dates and season changes, with an alert on the day).
      </p>
    </section>
  );
}
