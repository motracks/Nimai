import Link from "next/link";
import type { ReactNode } from "react";
import { INSTRUMENTS, MIN_RETAKE_DAYS, retakeCheck, type InstrumentKey } from "@/lib/instruments";
import { formatDay, getLatestCompletedAt } from "@/lib/retake";
import RetakeWarning from "@/components/RetakeWarning";

// Checked before the questionnaire opens, so nobody answers 50 questions only to
// be turned away on submit. submitAssessment enforces the same rule server-side.
export default async function RetakeGate({ instrument, children }: { instrument: InstrumentKey; children: ReactNode }) {
  const gate = retakeCheck(instrument, await getLatestCompletedAt(instrument));
  if (gate.status === "ok") return children;

  const meta = INSTRUMENTS[instrument];
  const ago = gate.daysSince === 0 ? "today" : gate.daysSince === 1 ? "yesterday" : `${gate.daysSince} days ago`;

  if (gate.status === "blocked") {
    return (
      <main className="vn-page" style={{ maxWidth: "42rem" }}>
        <p className="vn-eyebrow">{meta.label}</p>
        <h1 className="vn-heading mb-6">Not yet</h1>
        <div className="vn-card">
          <p className="vn-body">
            You took this {ago}. Retaking within {MIN_RETAKE_DAYS} days mostly measures how well you remember your
            answers, not how you&rsquo;ve changed, so it opens again on <strong>{formatDay(gate.availableOn)}</strong>.
          </p>
          <p className="vn-body mt-3">This is a slow-moving measure; the suggested gap between retakes is about {Math.round(meta.suggestedRetakeDays / 30)} months.</p>
          <p className="mt-6">
            <Link href={`/results/${instrument}`} className="vn-btn inline-block no-underline">
              See your result
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <RetakeWarning
      message={`You took this ${ago}. Your current state can shift quickly, but changes over just a few days are often noise. The suggested gap is about ${Math.round(meta.suggestedRetakeDays / 7)} weeks.`}
      resultHref={`/results/${instrument}`}
      title={meta.label}
    >
      {children}
    </RetakeWarning>
  );
}
