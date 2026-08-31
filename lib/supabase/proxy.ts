import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth-domain";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() refreshes the auth token if needed.
  // Don't run code between createServerClient and getUser - it can break the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");
  // System-initiated requests (Vercel Cron, queued jobs) hit /api/cron with
  // no Supabase session. The route handler enforces its own bearer-token
  // auth via CRON_SECRET; skip the cookie-based gate here so the cron
  // request isn't redirected to /login before the handler ever runs.
  const isCronRoute = path.startsWith("/api/cron");

  if (!user && !isAuthRoute && !isCronRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Carry where they were going, so signing in resumes it instead of
    // dumping everyone on the dashboard. This matters most for the cohort
    // join link (/learn/join?code=AI-1A) shared in Slack: the code lives in
    // the query string, and replacing the pathname alone used to drop the
    // destination while keeping a now-meaningless `?code=` on /login - which
    // also collides with the `code` param Supabase's own callback uses.
    //
    // The whole path+query goes into ONE encoded `next` value for that
    // reason: nothing from the original URL is left loose at the top level.
    const destination = `${path}${request.nextUrl.search}`;
    url.search = `?next=${encodeURIComponent(destination)}`;
    return NextResponse.redirect(url);
  }

  // Server-side domain gate. The login form has a client-side check, but it
  // is bypassable (anyone can call signInWithOtp directly). This is the
  // central enforcement point: any authed session whose email isn't on the
  // allowed domain gets signed out and bounced to /login. Runs on every
  // non-asset route, so a non-Phlo session can't survive a single request.
  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut(); // clears auth cookies via setAll above
    if (isAuthRoute) {
      // Already on /login or /auth - let the page render with cleared cookies.
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=domain_blocked";
    const redirect = NextResponse.redirect(url);
    // Carry the cleared auth cookies onto the redirect so the browser
    // forgets the session before it follows the Location header.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
