import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Route handlers don't get Next.js' built-in Server-Action CSRF protection,
  // so verify the request came from our own origin before signing the user
  // out. Worst case without this: a cross-site form forces logout.
  const origin = request.nextUrl.origin;
  const referer = request.headers.get("referer");
  const originHeader = request.headers.get("origin");
  const sameOrigin =
    (originHeader && originHeader === origin) ||
    (referer && referer.startsWith(`${origin}/`));
  if (!sameOrigin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
