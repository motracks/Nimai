import { createClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/supabase/errors";
import { parseCheckin, type CheckinAnswers } from "@/lib/checkin";

export interface CheckinRow {
  id: string;
  completedAt: string;
  answers: CheckinAnswers;
}

// Recent check-ins for the signed-in user (RLS). `ready` is false until the
// migration that creates the table has been applied.
export async function recentCheckins(limit = 10): Promise<{ ready: boolean; rows: CheckinRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("id, answers, completed_at")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) return { ready: !isMissingTable(error), rows: [] };
  return {
    ready: true,
    rows: (data ?? []).flatMap((r) => {
      const answers = parseCheckin(r.answers);
      return answers ? [{ id: r.id as string, completedAt: r.completed_at as string, answers }] : [];
    }),
  };
}
