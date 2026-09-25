import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInstrumentStatuses } from "@/lib/progress";
import { INSTRUMENTS, type InstrumentKey } from "@/lib/instruments";
import { InstrumentResultCard, VedicChartCard } from "@/components/ResultCards";
import { KIND_TEXT, buildHistories, vikritiVsPrakriti, type ResultRow } from "@/lib/results";

const ORDER: { key: InstrumentKey; title: string }[] = [
  { key: "bigfive", title: "Personality" },
  { key: "ecrr", title: "Attachment" },
  { key: "guna", title: "Guna" },
  { key: "prakriti", title: "Prakriti" },
  { key: "vikriti", title: "Vikriti" },
];

export default async function Home() {
  const { user, instruments } = await getInstrumentStatuses();
  const completeCount = instruments.filter((i) => i.complete).length;

  return (
    <main className="mx-auto max-w-xl px-8 py-16">
      <p className="serif-italic mb-2 text-sm" style={{ color: "var(--green-text)" }}>
        Verdic Nimai
      </p>
      <h1 className="serif mb-4 text-4xl" style={{ color: "var(--ink)" }}>
        A reflective profile,
        <br />
        drawn from several lenses.
      </h1>
      <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
        Take as many or as few of these as you like. Nothing here is mandatory — the
        synthesis works with whatever you bring to it.
      </p>

      {user && (
        <div className="mb-6 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--sand-dim)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(completeCount / instruments.length) * 100}%`,
                background: "var(--green-mid)",
              }}
            />
          </div>
          <span className="shrink-0 text-xs" style={{ color: "var(--ink-dim)" }}>
            {completeCount} of {instruments.length} complete
          </span>
        </div>
      )}

      <div className="mb-10 flex flex-col gap-2">
        {instruments.map((i) => (
          <Link
            key={i.key}
            // A completed, current result opens its own page. Not taken yet,
            // or due for a retake, opens the questionnaire.
            href={user && i.complete && !i.retakeDue ? `/results/${i.key}` : i.testHref}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-4 py-3 no-underline transition-colors"
            style={{
              borderColor: i.complete ? "var(--gold)" : "var(--ink-faint)",
              background: i.complete ? "var(--gold-dim)" : "var(--card)",
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span style={{ color: "var(--ink)" }}>{i.label}</span>
              {i.complete && (
                <span className="shrink-0 text-xs" style={{ color: "var(--green-text)" }}>
                  {i.retakeDue ? "Retake due" : "Complete"}
                </span>
              )}
            </span>
            <span
              className="serif-italic ml-auto text-sm"
              style={{ color: "var(--terracotta)" }}
            >
              {i.sub}
            </span>
          </Link>
        ))}
      </div>

      {!user && (
        <Link href="/login" className="vn-btn inline-block no-underline">
          Sign in to begin
        </Link>
      )}

      {user && completeCount > 0 && <ResultsOverview />}
    </main>
  );
}

// A quick, scrollable overview of everything completed so far, right on the
// home page. Each card here is the same content as that test's own page at
// /results/[instrument] — this is the "see everything at once" view, that
// page is the "fixed, single-test" view.
async function ResultsOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS scopes both queries to the signed-in user.
  const [results, vedic] = await Promise.all([
    supabase
      .from("assessment_results")
      .select("id, instrument, instrument_version, scoring_version, answers, result, source, completed_at")
      .order("completed_at", { ascending: true }),
    supabase.from("vedic_charts").select("*").maybeSingle(),
  ]);

  const histories = buildHistories((results.data ?? []) as ResultRow[]);
  const prakritiLatest = histories.prakriti?.latest.scored ?? null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="serif text-2xl" style={{ color: "var(--ink)" }}>
          Your results
        </h2>
        <Link href="/profile" className="text-sm" style={{ color: "var(--green-text)" }}>
          Combined profile →
        </Link>
      </div>

      {results.error && <p className="vn-error">{results.error.message}</p>}

      {ORDER.map(({ key, title }) => (
        <section key={key} id={`result-${key}`} className="vn-card scroll-mt-6">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="serif text-lg" style={{ color: "var(--ink)" }}>
              {title}
            </h3>
            {histories[key] && (
              <Link href={`/results/${key}`} className="text-xs" style={{ color: "var(--green-text)" }}>
                Full page →
              </Link>
            )}
          </div>
          <p className="mb-3 text-xs" style={{ color: "var(--ink-faint)" }}>
            {KIND_TEXT[INSTRUMENTS[key].kind]}
          </p>
          {histories[key] ? (
            <InstrumentResultCard
              history={histories[key]!}
              prakritiLatest={prakritiLatest}
              extra={
                key === "vikriti" && histories.vikriti?.latest.scored
                  ? vikritiVsPrakriti(histories.vikriti.latest.scored, prakritiLatest)
                  : null
              }
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              Not taken yet.{" "}
              <Link href={INSTRUMENTS[key].testHref} style={{ color: "var(--green-text)" }}>
                Take it
              </Link>
            </p>
          )}
        </section>
      ))}

      <section id="result-vedic" className="vn-cosmic scroll-mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="serif text-lg" style={{ color: "var(--gold-bright)" }}>
            Vedic chart
          </h3>
          {vedic.data && (
            <Link href="/results/vedic" className="text-xs" style={{ color: "var(--gold-bright)" }}>
              Full page →
            </Link>
          )}
        </div>
        {vedic.error && <p className="vn-error">{vedic.error.message}</p>}
        <VedicChartCard vedic={vedic.data} />
      </section>
    </div>
  );
}
