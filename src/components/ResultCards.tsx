import Link from "next/link";
import { INSTRUMENTS, type InstrumentKey } from "@/lib/instruments";
import { analyse, type Analysis } from "@/lib/analysis";
import AnalysisView from "@/components/AnalysisView";
import type { ScoredResult } from "@/lib/scoring";
import {
  FLAG_TEXT,
  bandDescription,
  classificationDescription,
  dimensionName,
  type InstrumentHistory,
  type ResultSnapshot,
} from "@/lib/results";

// The full rendering of one test's result: label, per-dimension scores with
// progress bars, the rule-based analysis, and the baseline comparison. Shared
// between the home page's inline overview and each test's own dedicated page
// at /results/[instrument], so both always show exactly the same thing.

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function InstrumentResultCard({
  history,
  extra,
  prakritiLatest,
}: {
  history: InstrumentHistory;
  extra: string | null;
  prakritiLatest: ScoredResult | null;
}) {
  const { key, latest, baseline, delta, count } = history;
  const meta = INSTRUMENTS[key];
  const analysis: Analysis | null = analyse(history, prakritiLatest);

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

      {analysis && <AnalysisView analysis={analysis} />}

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

// The Vedic chart block: shared the same way, between the home page overview
// and its own dedicated page at /results/vedic.
export function VedicChartCard({ vedic }: { vedic: Record<string, unknown> | null }) {
  if (!vedic) {
    return (
      <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
        Not taken yet.
      </p>
    );
  }
  const chart = vedic.chart as {
    moon_nakshatra: { name: string; pada: number };
    moon_reliable?: boolean;
    moon_range?: { nakshatras: string[] };
    ascendant?: { sign: string };
    chandra_lagna: { sign: string };
    planets: { name: string; sign: string }[];
  };

  return (
    <div className="flex flex-col gap-3">
      <p style={{ color: "var(--night-text)" }}>
        Moon in{" "}
        <span className="serif-italic" style={{ color: "var(--gold-bright)" }}>
          {chart.moon_nakshatra.name}
        </span>
        , pada {chart.moon_nakshatra.pada}
      </p>
      {chart.moon_reliable === false && (
        <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
          Without a birth time, the Moon&apos;s nakshatra could be{" "}
          {(chart.moon_range?.nakshatras ?? []).join(" or ")}, depending on the hour.
        </p>
      )}
      {vedic.ascendant_reliable ? (
        <p style={{ color: "var(--night-text)" }}>
          Ascendant:{" "}
          <span className="serif-italic" style={{ color: "var(--gold-bright)" }}>
            {chart.ascendant?.sign}
          </span>
        </p>
      ) : (
        <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
          Birth time unknown — ascendant and houses omitted. Using Chandra Lagna ({chart.chandra_lagna.sign}) instead.
        </p>
      )}
      <dl className="flex flex-col gap-1">
        {chart.planets.map((p) => (
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
  );
}
