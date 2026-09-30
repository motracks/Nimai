"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSTRUMENTS, isInstrumentKey, retakeCheck } from "@/lib/instruments";
import { formatDay, getLatestCompletedAt } from "@/lib/retake";
import { parseContext } from "@/lib/context";
import { isMissingColumn } from "@/lib/supabase/errors";
import { AnswerError, normaliseAnswers, scoreInstrument } from "@/lib/scoring";

export type SubmitResult = { ok: true } | { ok: false; error: string };

// The client sends answers only. Identity comes from the session, answers are
// validated against the current instrument, and scores are computed here, so a
// stored result always matches its answers and the scoring version it names.
export async function submitAssessment(instrument: unknown, answers: unknown, context?: unknown): Promise<SubmitResult> {
  if (!isInstrumentKey(instrument)) return { ok: false, error: "Unknown instrument" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again" };

  let stored: Record<string, unknown>;
  let result: ReturnType<typeof scoreInstrument>;
  try {
    stored = normaliseAnswers(instrument, answers);
    result = scoreInstrument(instrument, stored);
  } catch (err) {
    if (err instanceof AnswerError) return { ok: false, error: err.message };
    throw err;
  }

  const meta = INSTRUMENTS[instrument];
  const latest = await getLatestCompletedAt(instrument);
  const gate = retakeCheck(instrument, latest);
  if (gate.status === "blocked") {
    return { ok: false, error: `You took this ${gate.daysSince} days ago. You can retake it from ${formatDay(gate.availableOn)}.` };
  }

  // Season and travel context only mean something for the state tests.
  const ctx = meta.kind === "state" ? parseContext(context) : null;

  try {
    const row: Record<string, unknown> = {
      user_id: user.id,
      instrument,
      instrument_version: meta.instrumentVersion,
      scoring_version: meta.scoringVersion,
      answers: stored,
      result,
    };
    const admin = createAdminClient();
    let { error } = await admin.from("assessment_results").insert(ctx ? { ...row, context: ctx } : row);
    // Before the context migration is applied the column doesn't exist; the
    // result still matters more than its context, so save it without.
    if (error && ctx && isMissingColumn(error)) ({ error } = await admin.from("assessment_results").insert(row));

    if (error) {
      console.error("submitAssessment insert failed", error);
      return { ok: false, error: "Could not save your answers. Please try again." };
    }
    // The compass lives in the root layout, which a client navigation doesn't
    // re-render; refresh so it picks up this completion (and its new link).
    refresh();
    return { ok: true };
  } catch (err) {
    // Covers createAdminClient() throwing (e.g. SUPABASE_SERVICE_ROLE_KEY missing
    // in this environment) as well as a network failure on the insert itself.
    // Always return rather than throw here: an uncaught error crossing the server
    // action boundary becomes an unhandled rejection on the client, which leaves
    // the UI stuck on "Saving…" forever with no feedback.
    console.error("submitAssessment failed", err);
    return { ok: false, error: "Could not save your answers. Please try again." };
  }
}
