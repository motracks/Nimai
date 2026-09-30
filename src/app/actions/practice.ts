"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTable } from "@/lib/supabase/errors";
import { PRACTICES, acceptableDay } from "@/lib/practices";

export type LogResult = { ok: true } | { ok: false; error: string };

// Marks a practice done (or not) for the person's local day.
export async function logPractice(practice: unknown, done: unknown, day: unknown): Promise<LogResult> {
  if (typeof practice !== "string" || !Object.hasOwn(PRACTICES, practice) || typeof done !== "boolean" || !acceptableDay(day)) {
    return { ok: false, error: "That couldn't be saved." };
  }
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again" };

  try {
    const table = createAdminClient().from("practice_log");
    const { error } = done
      ? await table.upsert({ user_id: user.id, practice, done_on: day }, { onConflict: "user_id,practice,done_on", ignoreDuplicates: true })
      : await table.delete().eq("user_id", user.id).eq("practice", practice).eq("done_on", day);
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: "The practice log isn't set up on the server yet." };
      console.error("logPractice failed", error);
      return { ok: false, error: "Couldn't save that. Please try again." };
    }
    return { ok: true };
  } catch (err) {
    console.error("logPractice failed", err);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
}
