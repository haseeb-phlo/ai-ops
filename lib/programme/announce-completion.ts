import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/app-url";
import { resolveDisplayName } from "@/lib/profile";
import { programmeCompleteText } from "./messages";
import {
  claimSend,
  firstNameOf,
  notifyPerson,
  recordOutcome,
} from "./notify";

/**
 * DMs one person to say they have finished.
 *
 * THE DM ONLY. The cohort channel is not told here: a channel post per person
 * turns the last afternoon of a cohort into ten separate notifications, so the
 * public announcement is a single roundup posted at 4pm on the final Friday by
 * the `cohort_completion` job in /api/cron/programme-notify. This stays
 * immediate because it is addressed to one person and telling them the moment
 * they finish is the whole point.
 *
 * NEVER THROWS. A Slack outage must not turn into a failed request on the
 * path that just stamped someone's completion - the latch is already written,
 * and a missing DM is recoverable in a way a rolled-back completion is not.
 */
export async function announceCompletion(
  cohortMemberId: string,
): Promise<void> {
  try {
    await sendCompletion(cohortMemberId);
  } catch (error) {
    console.error(
      "[programme-completion] announce failed",
      cohortMemberId,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Uses the service-role client throughout: it reads another person's email and
 * writes the send log, neither of which a request-scoped client should do.
 *
 * `kind` is "certificate_issued". That string is pinned by a CHECK constraint
 * on programme_notification_sends, so renaming it would need a migration for
 * no user-visible gain - it appears only in the admin send log.
 */
async function sendCompletion(cohortMemberId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("programme_cohort_members")
    .select("id, user_id, programme_cohorts!inner(name)")
    .eq("id", cohortMemberId)
    .maybeSingle<{
      id: string;
      user_id: string;
      programme_cohorts: { name: string };
    }>();

  if (!member) return;

  const cohortName = member.programme_cohorts.name;
  const [{ data: emails }, { data: profile }] = await Promise.all([
    admin.rpc("user_emails", { p_user_ids: [member.user_id] }),
    admin
      .from("profiles")
      .select("user_id, display_name, slack_user_id")
      .eq("user_id", member.user_id)
      .maybeSingle<{
        user_id: string;
        display_name: string | null;
        slack_user_id: string | null;
      }>(),
  ]);

  const email =
    ((emails ?? []) as { user_id: string; email: string | null }[]).find(
      (e) => e.user_id === member.user_id,
    )?.email ?? null;

  const displayName = resolveDisplayName(
    profile?.display_name,
    null,
    email ?? "",
  );

  // Skipped without an email, because notifyPerson has no transport left once
  // the Slack lookup - which is keyed on the email - cannot run.
  if (!email) return;

  // Claim before sending: a retried after() callback or a cron sweep that
  // reaches the same member is then a no-op rather than a second DM.
  const claimed = await claimSend(admin, {
    kind: "certificate_issued",
    userId: member.user_id,
    periodKey: member.id,
  });
  if (!claimed) return;

  const outcome = await notifyPerson({
    supabase: admin,
    recipient: {
      userId: member.user_id,
      email,
      displayName,
      slackUserId: profile?.slack_user_id ?? null,
    },
    subject: "You've completed the Core Programme",
    text: programmeCompleteText({
      firstName: firstNameOf(displayName),
      cohortName,
      trackUrl: `${appUrl()}/learn/track`,
    }),
  });

  await recordOutcome(admin, {
    kind: "certificate_issued",
    userId: member.user_id,
    periodKey: member.id,
    outcome,
  });
}
