import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client for writes users must not make directly (scored results).
// Bypasses RLS, so callers must derive user_id from the session, never from input.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
