import { createClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/supabase/errors";
import type { LogEntry } from "@/lib/practices";

// The signed-in user's practice log for the last `days` days (RLS).
export async function practiceLog(days = 120): Promise<{ ready: boolean; rows: LogEntry[] }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await (await createClient())
    .from("practice_log")
    .select("practice, done_on")
    .gte("done_on", since)
    .order("done_on", { ascending: true });
  if (error) return { ready: !isMissingTable(error), rows: [] };
  return { ready: true, rows: (data ?? []) as LogEntry[] };
}
