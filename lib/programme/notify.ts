import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { lookupSlackUserId, postToChannel, sendSlackDm, slackEnabled } from "@/lib/slack";

/**
 * The single seam every programme notification goes through.
 *
 * TRANSPORT RULE: Slack DM first, email fallback whenever the Slack user
 * cannot be resolved. That is not hedging - Phlo is a shift-working business
 * and a meaningful number of frontline staff have no Slack account. Slack-only
 * would silently drop exactly the people most likely to fall behind, and a
 * notification that fails silently is worse than one that never existed.
 *
 * Channel posts have no email equivalent and simply no-op when Slack is
 * unconfigured; nothing else depends on them landing.
 *
 * SINGLE SEND: every send claims (kind, user, period) in
 * programme_notification_sends before doing anything. A retried or
 * double-fired cron hits the unique index and stops, so a hundred people do
 * not get DM'd twice.
 */

export type NotificationKind =
  | "member_reminder"
  | "lead_digest"
  | "cohort_summary"
  | "signoff_rejected"
  /**
   * The programme-completion DM and its cohort-channel post. The string is a
   * legacy name pinned by a CHECK constraint on programme_notification_sends;
   * renaming it needs a migration and buys nothing, since it appears only in
   * the admin send log. The two sends differ by period key.
   */
  | "certificate_issued"
  | "day_90_nudge";

export type Recipient = {
  userId: string;
  email: string;
  displayName: string;
  /** Cached Slack id, if we already have one. */
  slackUserId?: string | null;
};

export type DeliveryOutcome =
  | { via: "slack"; ok: true }
  | { via: "email"; ok: true }
  | { via: "none"; ok: false; reason: string };

type Client = ReturnType<typeof createAdminClient>;

/**
 * Claims a send. Returns false when this exact notification has already gone
 * out, which is the caller's cue to skip rather than to retry.
 */
export async function claimSend(
  supabase: Client,
  args: {
    kind: NotificationKind;
    userId: string | null;
    periodKey: string;
    channel?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase.from("programme_notification_sends").insert({
    kind: args.kind,
    user_id: args.userId,
    period_key: args.periodKey,
    channel: args.channel ?? null,
  });
  if (!error) return true;

  // 23505 is the unique violation: already claimed, so this notification has
  // already gone out and skipping is correct. Anything else is a real fault,
  // and we still skip - sending without a claim would risk a duplicate on the
  // next run - but it deserves a log line.
  if (error.code !== "23505") {
    console.error("[programme-notify] claim failed", args.kind, error.message);
  }
  return false;
}

/**
 * Resolves and caches a recipient's Slack id.
 *
 * A miss is cached as "not found for now" only in memory, never written as a
 * negative, so someone who joins Slack next week is picked up automatically.
 */
async function resolveSlackId(
  supabase: Client,
  recipient: Recipient,
): Promise<string | null> {
  if (recipient.slackUserId) return recipient.slackUserId;
  if (!slackEnabled) return null;

  const found = await lookupSlackUserId(recipient.email);
  if (found) {
    await supabase
      .from("profiles")
      .update({ slack_user_id: found })
      .eq("user_id", recipient.userId);
  }
  return found;
}

/**
 * Sends one message to one person: Slack if we can reach them, email if not.
 *
 * `subject` is only used by the email fallback - Slack DMs have no subject.
 */
export async function notifyPerson(args: {
  supabase: Client;
  recipient: Recipient;
  text: string;
  subject: string;
}): Promise<DeliveryOutcome> {
  const slackId = await resolveSlackId(args.supabase, args.recipient);

  if (slackId) {
    const result = await sendSlackDm(slackId, args.text);
    if (result.ok) return { via: "slack", ok: true };
    // Fall through to email rather than giving up: a Slack failure should not
    // cost someone their reminder.
  }

  if (!resend) return { via: "none", ok: false, reason: "no_transport" };

  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  const sent = await resend.emails.send({
    from,
    to: args.recipient.email,
    subject: args.subject,
    text: args.text,
  });

  return sent.error
    ? { via: "none", ok: false, reason: sent.error.message }
    : { via: "email", ok: true };
}

/** Posts to a cohort's channel. No-ops when there is no channel or no Slack. */
export async function notifyChannel(args: {
  channel: string | null;
  text: string;
}): Promise<DeliveryOutcome> {
  if (!args.channel) {
    return { via: "none", ok: false, reason: "no_channel_configured" };
  }
  if (!slackEnabled) {
    return { via: "none", ok: false, reason: "slack_not_configured" };
  }
  const result = await postToChannel(args.channel, args.text);
  return result.ok
    ? { via: "slack", ok: true }
    : { via: "none", ok: false, reason: "error" in result ? result.error : "skipped" };
}

/** Records the outcome against the claim, for the admin's send log. */
export async function recordOutcome(
  supabase: Client,
  args: {
    kind: NotificationKind;
    userId: string | null;
    periodKey: string;
    outcome: DeliveryOutcome;
  },
): Promise<void> {
  await supabase
    .from("programme_notification_sends")
    .update({
      succeeded: args.outcome.ok,
      detail: args.outcome.ok
        ? args.outcome.via
        : `failed: ${args.outcome.reason}`,
    })
    .eq("kind", args.kind)
    .eq("period_key", args.periodKey)
    .filter("user_id", args.userId === null ? "is" : "eq", args.userId);
}

/** First name, for message templates. Falls back to the whole display name. */
export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}
