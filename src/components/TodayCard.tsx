"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Cited } from "@/components/AnalysisView";
import { doshaOfHour, type TodayFocus } from "@/lib/today";

export default function TodayCard({ focus }: { focus: TodayFocus }) {
  // The hour comes from the reader's own clock: nothing on the server, the
  // local hour in the browser.
  const hour = useSyncExternalStore(
    () => () => {},
    () => new Date().getHours(),
    () => null,
  );
  const now = hour == null ? null : doshaOfHour(hour);

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
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
            {focus.do.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
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
        </Link>
      </p>
    </section>
  );
}
