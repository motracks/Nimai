"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSTRUMENTS, isInstrumentKey } from "@/lib/instruments";
import { AnswerError, normaliseAnswers, scoreInstrument } from "@/lib/scoring";

export type SubmitResult = { ok: true } | { ok: false; error: string };

// The client sends answers only. Identity comes from the session, answers are
// validated against the current instrument, and scores are computed here, so a
// stored result always matches its answers and the scoring version it names.
export async function submitAssessment(instrument: unknown, answers: unknown): Promise<SubmitResult> {
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
  try {
    const { error } = await createAdminClient().from("assessment_results").insert({
      user_id: user.id,
      instrument,
      instrument_version: meta.instrumentVersion,
      scoring_version: meta.scoringVersion,
      answers: stored,
      result,
    });

    if (error) {
      console.error("submitAssessment insert failed", error);
      return { ok: false, error: "Could not save your answers. Please try again." };
    }
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
