import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TASK_EVIDENCE_BUCKET } from "@/lib/programme/task-link";

/**
 * Serves a screenshot a member filed against a day's Task.
 *
 * The bucket is private, so what a browser can fetch is a signed URL that
 * expires. Storing one would hand somebody a dead image a minute later, so
 * the path is what gets stored and this mints a fresh URL per request.
 *
 * AUTHORISATION IS THE BUCKET'S, NOT THIS FILE'S. The redirect is signed with
 * the caller's own session, so `createSignedUrl` fails unless the storage
 * policy - `can_view_cohort_member` on the first path segment, the same
 * helper guarding every other programme table - says yes. A lead sees their
 * members' evidence, a super admin sees everyone's, and nobody else sees
 * anything. Do not "simplify" this to the admin client: it would serve any
 * member's screenshot to any signed-in colleague.
 *
 * The stored path deliberately has no file extension - see the
 * task_evidence_uploads migration. proxy.ts's matcher excludes anything
 * ending .png/.jpg/.webp from the auth gate, so an extension here would mean
 * an unrefreshed session and an image that breaks for whoever was due a token
 * refresh.
 */

export const dynamic = "force-dynamic";

/** Long enough to load the image, short enough that a copied URL is useless. */
const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  await getSessionUser();

  const { path } = await params;
  if (
    path.length !== 3 ||
    path.some((segment) => !/^[0-9a-f-]{36}$/i.test(segment))
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .createSignedUrl(path.join("/"), SIGNED_URL_TTL_SECONDS);

  // Not found rather than forbidden: whether a given member filed a
  // screenshot on a given day is not something a caller who cannot read it
  // should be able to probe for.
  if (error || !data?.signedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  const response = NextResponse.redirect(data.signedUrl, 307);
  // The target expires; a cached redirect would outlive it.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
