"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTable } from "@/lib/supabase/errors";
import { parseCheckin } from "@/lib/checkin";

export type CheckinResult = { ok: true } | { ok: false; error: string };

export async function submitCheckin(input: unknown): Promise<CheckinResult> {
  const answers = parseCheckin(input);
  if (!answers) return { ok: false, error: "Please answer all four." };

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again" };

  try {
    const { error } = await createAdminClient().from("checkins").insert({ user_id: user.id, answers });
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: "Check-ins aren't set up on the server yet." };
      console.error("submitCheckin failed", error);
      return { ok: false, error: "Could not save your check-in. Please try again." };
    }
    return { ok: true };
  } catch (err) {
    console.error("submitCheckin failed", err);
    return { ok: false, error: "Could not save your check-in. Please try again." };
  }
}
