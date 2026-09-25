import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INSTRUMENTS, type InstrumentKey } from "@/lib/instruments";
import {
  FLAG_TEXT,
  KIND_TEXT,
  bandDescription,
  buildHistories,
  classificationDescription,
  dimensionName,
  vikritiVsPrakriti,
  type InstrumentHistory,
  type ResultRow,
  type ResultSnapshot,
} from "@/lib/results";

const ORDER: { key: InstrumentKey; title: string }[] = [
  { key: "bigfive", title: "Personality" },
  { key: "ecrr", title: "Attachment" },
  { key: "guna", title: "Guna" },
  { key: "prakriti", title: "Prakriti" },
  { key: "vikriti", title: "Vikriti" },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function ResultsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
    <main className="vn-page">
      <p className="vn-eyebrow">Verdic Nimai</p>
      <h1 className="vn-heading mb-8">Your results</h1>

      {results.error && <p className="vn-error mb-4">{results.error.message}</p>}

      {ORDER.map(({ key, title }) => (
        <section key={key} className="vn-card mb-4">
          <h2 className="serif mb-1 text-lg" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--ink-faint)" }}>
            {KIND_TEXT[INSTRUMENTS[key].kind]}
          </p>
          {histories[key] ? (
            <InstrumentResult
              history={histories[key]!}
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

      <section className="vn-cosmic">
        <h2 className="serif mb-3 text-lg" style={{ color: "var(--gold-bright)" }}>
          Vedic chart
        </h2>
        {vedic.error && <p className="vn-error">{vedic.error.message}</p>}
        {!vedic.error && !vedic.data && (
          <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
            Not taken yet.
          </p>
        )}
        {vedic.data && (
          <div className="flex flex-col gap-3">
            <p style={{ color: "var(--night-text)" }}>
              Moon in{" "}
              <span className="serif-italic" style={{ color: "var(--gold-bright)" }}>
                {vedic.data.chart.moon_nakshatra.name}
              </span>
              , pada {vedic.data.chart.moon_nakshatra.pada}
            </p>
            {vedic.data.chart.moon_reliable === false && (
              <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
                Without a birth time, the Moon&apos;s nakshatra could be{" "}
                {(vedic.data.chart.moon_range?.nakshatras ?? []).join(" or ")}, depending on the hour.
              </p>
            )}
            {vedic.data.ascendant_reliable ? (
              <p style={{ color: "var(--night-text)" }}>
                Ascendant:{" "}
                <span className="serif-italic" style={{ color: "var(--gold-bright)" }}>
                  {vedic.data.chart.ascendant.sign}
                </span>
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
                Birth time unknown — ascendant and houses omitted. Using Chandra Lagna (
                {vedic.data.chart.chandra_lagna.sign}) instead.
              </p>
            )}
            <dl className="flex flex-col gap-1">
              {(vedic.data.chart.planets as { name: string; sign: string }[]).map((p) => (
                <div
                  key={p.name}
                  className="flex justify-between py-1"
                  style={{ borderBottom: "1px solid rgba(201, 166, 104, 0.15)" }}
                >
                  <dt className="text-sm" style={{ color: "var(--night-text-dim)" }}>
                    {p.name}
                  </dt>
                  <dd style={{ color: "var(--night-text)" }}>{p.sign}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}

function InstrumentResult({ history, extra }: { history: InstrumentHistory; extra: string | null }) {
  const { key, latest, baseline, delta, count } = history;
  const meta = INSTRUMENTS[key];

  return (
    <div className="flex flex-col gap-3">
      <Snapshot instrument={key} snap={latest} delta={delta} />

      {extra && (
        <p className="text-sm" style={{ color: "var(--ink-mid)" }}>
          {extra}
        </p>
      )}

      {baseline && (
        <div className="pt-2" style={{ borderTop: "1px solid var(--sand-dim)" }}>
          <p className="mb-1 text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--ink-dim)" }}>
            Baseline · {formatDate(baseline.completedAt)} · {count} results so far
          </p>
          <BaselineSummary instrument={key} baseline={baseline} latest={latest} />
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        Latest {formatDate(latest.completedAt)} · suggested retake every {meta.suggestedRetakeDays} days ·{" "}
        <Link href={meta.testHref} style={{ color: "var(--green-text)" }}>
          Retake
        </Link>
      </p>
    </div>
  );
}

function Snapshot({
  instrument,
  snap,
  delta,
}: {
  instrument: InstrumentKey;
  snap: ResultSnapshot;
  delta: Record<string, number> | null;
}) {
  if (!snap.scored) {
    return (
      <div className="flex flex-col gap-1">
        {snap.legacy?.label && <p style={{ color: "var(--ink)" }}>{snap.legacy.label}</p>}
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {snap.versionNote}
        </p>
      </div>
    );
  }

  const { classification, norm, shares, quality } = snap.scored;
  const description = classificationDescription(instrument, snap.scored);
  const values = shares ?? norm;
  const unit = shares ? "%" : "";

  return (
    <div className="flex flex-col gap-2">
      {classification.label && (
        <p className="serif-italic text-lg" style={{ color: "var(--ink)" }}>
          {classification.label}
        </p>
      )}
      {description && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
          {description}
        </p>
      )}

      <dl className="flex flex-col gap-2">
        {Object.entries(values).map(([dim, value]) => {
          const dimLabel = classification.dimensionLabels?.[dim];
          const bandText = dimLabel ? bandDescription(instrument, dim, dimLabel) : null;
          const change = delta?.[dim];
          return (
            <div key={dim} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  {dimensionName(instrument, dim)}
                  {dimLabel && dimLabel !== "elevated" && (
                    <span style={{ color: "var(--ink)" }}> · {dimLabel}</span>
                  )}
                </dt>
                <dd className="shrink-0 text-sm" style={{ color: "var(--ink)" }}>
                  {instrument === "vikriti" ? `${snap.scored!.raw[dim]} / 6` : `${Math.round(value)}${unit}`}
                  {change != null && (
                    <span className="ml-2 text-xs" style={{ color: "var(--ink-dim)" }}>
                      {Math.abs(change) < 5 ? "steady" : `${change > 0 ? "+" : ""}${Math.round(change)}`}
                    </span>
                  )}
                </dd>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--sand-dim)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, norm[dim]))}%`, background: "var(--green-mid)" }}
                />
              </div>
              {bandText && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                  {bandText}
                </p>
              )}
            </div>
          );
        })}
      </dl>

      {quality.flags.map((f) => (
        <p key={f} className="text-xs" style={{ color: "var(--terracotta)" }}>
          {FLAG_TEXT[f] ?? f}
        </p>
      ))}
    </div>
  );
}

function BaselineSummary({
  instrument,
  baseline,
  latest,
}: {
  instrument: InstrumentKey;
  baseline: ResultSnapshot;
  latest: ResultSnapshot;
}) {
  const baseLabel = baseline.scored?.classification.label ?? baseline.legacy?.label ?? null;
  const latestLabel = latest.scored?.classification.label ?? latest.legacy?.label ?? null;
  const constitution = INSTRUMENTS[instrument].kind === "constitution";

  let note: string | null = null;
  if (!baseline.comparable) note = baseline.versionNote;
  else if (baseLabel && latestLabel && constitution)
    note =
      baseLabel === latestLabel
        ? "Consistent with your first result."
        : "Differs from your first result. For a constitution that's worth a careful re-check, not a sign of change.";
  else if (baseLabel && latestLabel && baseLabel !== latestLabel) note = `Moved from ${baseLabel} to ${latestLabel}.`;

  return (
    <div className="flex flex-col gap-1">
      {baseLabel && (
        <p className="text-sm" style={{ color: "var(--ink-mid)" }}>
          {baseLabel}
        </p>
      )}
      {note && (
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
