"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { logPractice } from "@/app/actions/practice";
import { localDay, type LogEntry } from "@/lib/practices";
import { Cited } from "@/components/AnalysisView";
import { doshaOfHour, type TodayFocus } from "@/lib/today";

const noSubscribe = () => () => {};

export default function TodayCard({ focus, log }: { focus: TodayFocus; log: { ready: boolean; rows: LogEntry[] } }) {
  // The hour comes from the reader's own clock: nothing on the server, the
  // local hour in the browser.
  const hour = useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => null);
  const today = useSyncExternalStore(noSubscribe, () => localDay(new Date()), () => null);
  const now = hour == null ? null : doshaOfHour(hour);

  // Ticks show at once and roll back if the save fails.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [logError, setLogError] = useState("");
  const loggedToday = new Set(log.rows.filter((r) => r.done_on === today).map((r) => r.practice));
  const isDone = (id: string) => overrides[id] ?? loggedToday.has(id);

  async function toggle(id: string) {
    if (!today) return;
    const next = !isDone(id);
    setOverrides((o) => ({ ...o, [id]: next }));
    setLogError("");
    const res = await logPractice(id, next, today).catch(() => ({ ok: false as const, error: "Couldn't save that." }));
    if (!res.ok) {
      setOverrides((o) => ({ ...o, [id]: !next }));
      setLogError(res.error);
    }
  }

  return (
    <section className="vn-card mb-6" aria-labelledby="today-heading">
      <h2 id="today-heading" className="text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
        Today · {focus.name}
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
        {focus.reason}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs" style={{ color: "var(--ink)" }}>
            Do
          </h3>
          {log.ready && today ? (
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
              {focus.do.map((d) => (
                <li key={d.id}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={isDone(d.id)} onChange={() => toggle(d.id)} />
                    <span>{d.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
              {focus.do.map((d) => (
                <li key={d.id}>{d.text}</li>
              ))}
            </ul>
          )}
          {log.ready && (
            <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>
              Tick what you did today.{" "}
              <Link href="/practice" className="vn-link">
                Your log
              </Link>
            </p>
          )}
          {logError && <p className="vn-error mt-1 text-xs">{logError}</p>}
        </div>
        <div>
          <h3 className="mb-1 text-xs" style={{ color: "var(--ink)" }}>
            Go easy on
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
            {focus.avoid.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>

      {now && (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-mid)" }}>
          <Cited text={`Right now it's ${now.name} time (about ${now.span}): ${now.note} (Svoboda, Ayurveda: Life, Health and Longevity, ch.4)`} />
        </p>
      )}
      {focus.guna && (
        <p className="mt-2 text-sm" style={{ color: "var(--ink-mid)" }}>
          Guna: {focus.guna}
        </p>
      )}

      <p className="mt-3 text-xs" style={{ color: "var(--ink-dim)" }}>
        General guidance from your results, not medical advice.{" "}
        <Link href={focus.href} className="vn-link">
          Why this?
        </Link>{" "}
        ·{" "}
        <Link href="/checkin" className="vn-link">
          Quick check-in
        </Link>
      </p>
    </section>
  );
}
