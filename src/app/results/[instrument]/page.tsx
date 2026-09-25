import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INSTRUMENTS, isInstrumentKey } from "@/lib/instruments";
import { InstrumentResultCard, VedicChartCard } from "@/components/ResultCards";
import { KIND_TEXT, buildHistories, vikritiVsPrakriti, type ResultRow } from "@/lib/results";

// A fixed, single-test view: same content as its card on the home page
// overview, but its own stable URL, so a compass tap or a bookmark always
// lands on exactly this test's result rather than scrolling a shared page.
// "vedic" is handled alongside the five scored instruments; anything else 404s.

const COLUMNS = "id, instrument, instrument_version, scoring_version, answers, result, source, completed_at";

export default async function InstrumentResultPage({
  params,
}: {
  params: Promise<{ instrument: string }>;
}) {
  const { instrument } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (instrument === "vedic") {
    const { data: vedic, error } = await supabase.from("vedic_charts").select("*").maybeSingle();
    return (
      <main className="vn-page" style={{ maxWidth: "34rem" }}>
        <BackLink />
        <section className="vn-cosmic">
          <h1 className="serif mb-3 text-2xl" style={{ color: "var(--gold-bright)" }}>
            Vedic chart
          </h1>
          {error && <p className="vn-error">{error.message}</p>}
          <VedicChartCard vedic={vedic} />
        </section>
      </main>
    );
  }

  if (!isInstrumentKey(instrument)) notFound();

  const meta = INSTRUMENTS[instrument];
  const { data: rows, error } = await supabase
    .from("assessment_results")
    .select(COLUMNS)
    .eq("instrument", instrument)
    .order("completed_at", { ascending: true });

  const history = buildHistories((rows ?? []) as ResultRow[])[instrument];

  // Vikriti is read against the latest Prakriti, so fetch that separately.
  let prakritiLatest = null;
  if (instrument === "vikriti") {
    const { data: prakritiRows } = await supabase
      .from("assessment_results")
      .select(COLUMNS)
      .eq("instrument", "prakriti")
      .order("completed_at", { ascending: true });
    prakritiLatest = buildHistories((prakritiRows ?? []) as ResultRow[]).prakriti?.latest.scored ?? null;
  }

  return (
    <main className="vn-page" style={{ maxWidth: "34rem" }}>
      <BackLink />
      <p className="vn-eyebrow">{meta.label}</p>
      <h1 className="vn-heading mb-2">{history?.latest.scored?.classification.label ?? meta.label}</h1>
      <p className="mb-6 text-xs" style={{ color: "var(--ink-faint)" }}>
        {KIND_TEXT[meta.kind]}
      </p>

      {error && <p className="vn-error mb-4">{error.message}</p>}

      <section className="vn-card">
        {history ? (
          <InstrumentResultCard
            history={history}
            prakritiLatest={prakritiLatest}
            extra={
              instrument === "vikriti" && history.latest.scored
                ? vikritiVsPrakriti(history.latest.scored, prakritiLatest)
                : null
            }
          />
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Not taken yet.{" "}
            <Link href={meta.testHref} style={{ color: "var(--green-text)" }}>
              Take it
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}

function BackLink() {
  return (
    <p className="mb-6 text-sm">
      <Link href="/" style={{ color: "var(--green-text)" }}>
        ← All results
      </Link>
    </p>
  );
}
