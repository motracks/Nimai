import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { practiceLog } from "@/lib/practice-server";
import { lastDays, practiceCounts, practicePatterns } from "@/lib/practice-patterns";
import { RESULT_COLUMNS, buildHistories, type ResultRow } from "@/lib/results";

export const metadata: Metadata = { title: "Practice log · Nimai" };

export default async function PracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [log, results] = await Promise.all([
    practiceLog(120),
    supabase.from("assessment_results").select(RESULT_COLUMNS).eq("instrument", "vikriti").order("completed_at", { ascending: true }),
  ]);
  const counts = practiceCounts(lastDays(log.rows, 28));
  const patterns = practicePatterns(buildHistories((results.data ?? []) as ResultRow[]).vikriti, log.rows);

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">Practice</p>
      <h1 className="vn-heading mb-3">What you&rsquo;ve been doing</h1>
      <p className="vn-body mb-8">
        Tick practices on the{" "}
        <Link href="/" className="vn-link">
          Today card
        </Link>
        . Over time this page shows what you did, and what your Vikriti did alongside it.
      </p>

      {!log.ready ? (
        <p className="vn-card text-sm" style={{ color: "var(--ink-mid)" }}>
          The practice log isn&rsquo;t set up on the server yet. It&rsquo;ll appear here once the latest database update
          has been applied.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="mb-2 text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
              Last 4 weeks
            </h2>
            {counts.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                Nothing logged yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm" style={{ color: "var(--ink-mid)" }}>
                {counts.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3">
                    <span>
                      {c.text} <span style={{ color: "var(--ink-dim)" }}>({c.dosha})</span>
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--ink)" }}>
                      {c.days} day{c.days === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
              Alongside your Vikriti
            </h2>
            {patterns.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                This fills in once you have logged practices between two Vikriti checks while a dosha was raised.
              </p>
            ) : (
              <>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
                  {patterns.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs" style={{ color: "var(--ink-dim)" }}>
                  Patterns, not proof: season, sleep, stress and much else change at the same time.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
