import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/app-url";
import { resolveDisplayName } from "@/lib/profile";
import { rejectionText } from "./messages";
import { claimSend, firstNameOf, notifyPerson, recordOutcome } from "./notify";

/**
 * Tells a member their submission came back, and what to change.
 *
 * Claimed on the submission id, so a lead who double-clicks does not send two
 * DMs. Never throws: the sign-off is already recorded and a messaging failure
 * must not undo it - worst case the member sees the comment next time they
 * open their track.
 */
export async function notifyRejection(args: {
  submissionId: string;
  leadUserId: string;
  comment: string;
}): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { data: submission } = await supabase
      .from("programme_submissions")
      .select(
        "id, track_item_id, cohort_member_id, programme_cohort_members!inner(user_id)",
      )
      .eq("id", args.submissionId)
      .maybeSingle<{
        id: string;
        track_item_id: string | null;
        cohort_member_id: string;
        programme_cohort_members: { user_id: string };
      }>();
    if (!submission) return;

    const memberUserId = submission.programme_cohort_members.user_id;

    const [emails, { data: profiles }, { data: item }] = await Promise.all([
      supabase.rpc("user_emails", {
        p_user_ids: [memberUserId, args.leadUserId],
      }),
      supabase
        .from("profiles")
        .select("user_id, display_name, slack_user_id")
        .in("user_id", [memberUserId, args.leadUserId])
        .returns<
          {
            user_id: string;
            display_name: string | null;
            slack_user_id: string | null;
          }[]
        >(),
      submission.track_item_id
        ? supabase
            .from("programme_track_items")
            .select("title")
            .eq("id", submission.track_item_id)
            .maybeSingle<{ title: string }>()
        : Promise.resolve({ data: null }),
    ]);

    const emailByUserId = new Map(
      ((emails.data ?? []) as { user_id: string; email: string | null }[])
        .filter((e) => e.email)
        .map((e) => [e.user_id, e.email!]),
    );
    const profileByUserId = new Map(
      (profiles ?? []).map((p) => [p.user_id, p]),
    );

    const memberEmail = emailByUserId.get(memberUserId);
    if (!memberEmail) return;

    const memberProfile = profileByUserId.get(memberUserId);
    const memberName = resolveDisplayName(
      memberProfile?.display_name,
      null,
      memberEmail,
    );
    const leadName = resolveDisplayName(
      profileByUserId.get(args.leadUserId)?.display_name,
      null,
      emailByUserId.get(args.leadUserId) ?? "",
    );

    const claimed = await claimSend(supabase, {
      kind: "signoff_rejected",
      userId: memberUserId,
      periodKey: submission.id,
    });
    if (!claimed) return;

    const outcome = await notifyPerson({
      supabase,
      recipient: {
        userId: memberUserId,
        email: memberEmail,
        displayName: memberName,
        slackUserId: memberProfile?.slack_user_id ?? null,
      },
      subject: "Your Core Programme submission came back",
      text: rejectionText({
        firstName: firstNameOf(memberName),
        itemTitle: item?.title ?? "submission",
        leadName: firstNameOf(leadName),
        comment: args.comment,
        trackUrl: `${appUrl()}/learn/track`,
      }),
    });

    await recordOutcome(supabase, {
      kind: "signoff_rejected",
      userId: memberUserId,
      periodKey: submission.id,
      outcome,
    });
  } catch (error) {
    console.error(
      "[programme-notify] rejection notice failed",
      error instanceof Error ? error.message : error,
    );
  }
}
