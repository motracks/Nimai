import { createClient } from "@/lib/supabase/server";
import type { InstrumentKey } from "@/lib/instruments";

// Latest completion for the signed-in user. The view is security_invoker, so
// RLS limits it to the caller's own rows.
export async function getLatestCompletedAt(instrument: InstrumentKey): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("current_assessment_results")
    .select("completed_at")
    .eq("instrument", instrument)
    .maybeSingle();
  return (data?.completed_at as string | undefined) ?? null;
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
