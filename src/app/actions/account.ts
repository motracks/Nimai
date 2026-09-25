"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Every table that stores a row per user, keyed by user_id. The legacy
// per-instrument tables were created outside the migrations folder (see
// docs/rating-engine-review.md), so a table listed here might not exist in
// every environment — both actions below treat a missing table as nothing to
// do, not a failure, so export/delete still work on a fresh database.
const TABLES = [
  "assessment_results",
  "bigfive_results",
  "ecrr_results",
  "guna_results",
  "prakriti_results",
  "prakriti_vikriti_results",
  "vedic_charts",
  "birth_data",
] as const;

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

// Every row of every table above, for the signed-in user only — the data
// access right. Uses the admin client because some of the legacy tables'
// RLS policies aren't in the repo to check, but the id it filters by always
// comes from the authenticated session, never from the caller.
export async function exportMyData(): Promise<ActionResult<string>> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Please sign in again." };
  }

  try {
    const admin = createAdminClient();
    const out: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, created_at: user.created_at },
    };
    for (const table of TABLES) {
      const { data, error } = await admin.from(table).select("*").eq("user_id", user.id);
      if (!error) out[table] = data;
      // A missing table (fresh database) or any other read error is skipped,
      // not fatal — the export still contains everything that did work.
    }
    return { ok: true, data: JSON.stringify(out, null, 2) };
  } catch (err) {
    console.error("exportMyData failed", err);
    return { ok: false, error: "Could not export your data. Please try again." };
  }
}

// Deletes every row for this user across every table, then the auth account
// itself — the erasure right. Best-effort across tables (a missing one is
// skipped) so one absent legacy table never blocks the rest; the auth
// account is only deleted once the data deletes have been attempted.
export async function deleteMyAccount(): Promise<ActionResult> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Please sign in again." };
  }

  try {
    const admin = createAdminClient();
    for (const table of TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) console.error(`deleteMyAccount: could not clear ${table}`, error);
    }

    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("deleteMyAccount: could not delete auth account", authError);
      return {
        ok: false,
        error: "Your data was deleted, but the account itself couldn't be removed. Please contact support to finish.",
      };
    }
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("deleteMyAccount failed", err);
    return { ok: false, error: "Could not delete your account. Please try again." };
  }
}
