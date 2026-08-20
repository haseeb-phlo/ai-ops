import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth-domain";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Open-redirect guard: only allow relative paths under our origin.
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Don't echo Supabase's raw error string into the URL - collapse all
  // exchange failures (expired, scanner-consumed, cross-browser PKCE
  // mismatch, etc.) into one user-facing slug. The login page maps it
  // to a friendly message and prompts for a fresh code.
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  // Server-side domain gate. The proxy is the primary enforcement point,
  // but bouncing here too means a non-Phlo session never even briefly
  // exists with an active cookie post-redirect.
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain_blocked`);
  }

  // Bind any "Your AI Score" responses stored against this person's email but
  // not yet to their account - the May 2026 wave predates cohorts, and some
  // respondents are signing in here for the first time. Cheap (indexed on
  // unlinked rows) and idempotent, so running it on every sign-in is fine.
  // Failure is non-fatal: it just retries next time, and nothing downstream
  // joins on user_id.
  const { error: linkError } = await supabase.rpc("link_ai_score_responses");
  if (linkError) {
    console.warn("[auth-callback] AI Score link failed", linkError.message);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
