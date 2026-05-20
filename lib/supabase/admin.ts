import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Use ONLY in server-side, system-initiated
 * contexts (Cron, queued jobs, internal RPC handlers). Never on a request
 * path where the caller is a human - those should use `lib/supabase/server`
 * so RLS is enforced against the user's JWT.
 *
 * `auth.persistSession: false` keeps this stateless across invocations;
 * `autoRefreshToken: false` skips the background refresh that's pointless
 * for a service-role key.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env. Throws at first use if missing
 * rather than at import so test/dev environments without the key still boot.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
