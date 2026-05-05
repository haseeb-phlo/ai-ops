import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Defense in depth: NODE_ENV is the primary gate, but if SUPABASE_SERVICE_
  // ROLE_KEY ever leaks into a non-dev env this route would otherwise become
  // passwordless account takeover for any email. Pinning to localhost makes
  // a leaked-key scenario non-exploitable from outside the host.
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }
  const host = request.headers.get("host") ?? "";
  const isLocalhost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (!isLocalhost) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return new NextResponse(
      "Missing ?email=... param (e.g. /auth/dev-login?email=you@wearephlo.com)",
      { status: 400 },
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new NextResponse(
      "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local",
      { status: 500 },
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    return new NextResponse(
      `Failed to generate link: ${error?.message ?? "unknown error"}`,
      { status: 500 },
    );
  }

  const supabase = await createServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    return new NextResponse(`Failed to verify token: ${verifyError.message}`, {
      status: 500,
    });
  }

  return NextResponse.redirect(`${origin}/`);
}
