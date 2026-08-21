"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { postToChannel, slackEnabled } from "@/lib/slack";

/**
 * Posts a test message to a cohort's Slack channel.
 *
 * There is no way to tell from the outside whether a channel name is right,
 * whether the bot was invited or whether the token has the scopes it needs,
 * and all three fail the same way in production: silently, at 09:00 on a
 * Friday, to nobody.
 *
 * So this sends a real message and translates Slack's error code into the
 * specific thing to go and fix. Slack's codes are precise; the useless part is
 * that nobody sees them, which is what this fixes.
 */

const TestSchema = z.object({ cohort_id: z.string().uuid() });

export type SlackTestState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; channel: string };

/** Slack's error codes, translated into the thing to actually do. */
const SLACK_ERROR_HELP: Record<string, string> = {
  channel_not_found:
    "Slack doesn't recognise that channel. Check the name matches exactly, without the #, and that the channel isn't private (a private channel needs the bot invited before it is even visible).",
  not_in_channel:
    "The channel exists but the bot isn't a member. Run /invite @AI Ops in the channel and try again.",
  is_archived: "That channel is archived. Unarchive it or point the cohort at a live one.",
  invalid_auth:
    "The bot token was rejected. Check SLACK_BOT_TOKEN in Vercel matches the Bot User OAuth Token, and that the app is still installed.",
  not_authed: "No bot token reached Slack. Check SLACK_BOT_TOKEN is set for this environment.",
  account_inactive: "That bot's Slack account has been deactivated.",
  missing_scope:
    "The token is missing a scope. It needs chat:write, users:read and users:read.email, then a reinstall of the app.",
  restricted_action:
    "A workspace policy blocked the post. A Slack admin will need to allow the app to post in that channel.",
  ratelimited: "Slack rate-limited us. Wait a minute and try again.",
};

export async function sendSlackTest(
  _prev: SlackTestState,
  formData: FormData,
): Promise<SlackTestState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can send a test." };
  }

  if (!slackEnabled) {
    return {
      kind: "error",
      message:
        "SLACK_BOT_TOKEN isn't set in this environment, so nothing was sent. Notifications will fall back to email until it is.",
    };
  }

  const parsed = TestSchema.safeParse({ cohort_id: formData.get("cohort_id") });
  if (!parsed.success) return { kind: "error", message: "Pick a cohort." };

  const supabase = await createClient();
  const { data: cohort } = await supabase
    .from("programme_cohorts")
    .select("name, slack_channel")
    .eq("id", parsed.data.cohort_id)
    .maybeSingle<{ name: string; slack_channel: string | null }>();

  if (!cohort?.slack_channel) {
    return {
      kind: "error",
      message: "This cohort has no Slack channel set. Add one and save first.",
    };
  }

  const result = await postToChannel(
    cohort.slack_channel,
    `Test message from AI Ops. If you can see this, ${cohort.name}'s notifications will reach this channel. Nothing else to do.`,
  );

  if (result.ok) return { kind: "success", channel: cohort.slack_channel };

  const code = "error" in result ? result.error : "unknown";
  return {
    kind: "error",
    message: SLACK_ERROR_HELP[code] ?? `Slack rejected it with "${code}".`,
  };
}
