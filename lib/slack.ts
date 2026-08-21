import "server-only";

/**
 * Slack, mirroring lib/resend.ts: configured client or null.
 *
 * When SLACK_BOT_TOKEN is unset every call no-ops and reports `skipped`, so
 * dev, CI and preview boot without a token and callers null-check rather than
 * throw. The programme degrades to email in that case rather than failing.
 *
 * Written against the Web API directly rather than @slack/web-api: we need
 * four methods, and the dependency is a large surface for that.
 *
 * Scopes required on the bot token:
 *   chat:write        post messages and DMs
 *   users:read        resolve members
 *   users:read.email  map a Phlo email to a Slack member id
 */

const SLACK_API = "https://slack.com/api";

export const slackToken = process.env.SLACK_BOT_TOKEN?.trim() || null;

/** True when Slack is configured. Callers branch on this, not on a throw. */
export const slackEnabled = slackToken !== null;

export type SlackResult =
  | { ok: true; channel: string }
  | { ok: false; skipped: true }
  | { ok: false; skipped?: false; error: string };

async function call<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!slackToken) return { ok: false, error: "not_configured" };

  try {
    const response = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as { ok: boolean; error?: string };
    if (!json.ok) return { ok: false, error: json.error ?? "unknown_error" };
    return { ok: true, data: json as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "network_error",
    };
  }
}

/**
 * Slack member id for a Phlo email, or null when there is no matching account.
 *
 * Null is an ordinary outcome, not an error: plenty of frontline staff have no
 * Slack account, which is exactly why the notification layer falls back to
 * email rather than treating this as a failure.
 */
export async function lookupSlackUserId(
  email: string,
): Promise<string | null> {
  const result = await call<{ user?: { id?: string } }>("users.lookupByEmail", {
    email: email.toLowerCase(),
  });
  if (!result.ok) return null;
  return result.data.user?.id ?? null;
}

/** Posts to a channel. `channel` may be a name or an id; Slack accepts both. */
export async function postToChannel(
  channel: string,
  text: string,
): Promise<SlackResult> {
  if (!slackEnabled) return { ok: false, skipped: true };
  const result = await call<unknown>("chat.postMessage", {
    channel: channel.replace(/^#/, ""),
    text,
    // Suppress link previews: a digest full of deep links would otherwise
    // unfurl into an unreadable wall.
    unfurl_links: false,
    unfurl_media: false,
  });
  return result.ok
    ? { ok: true, channel }
    : { ok: false, error: result.error };
}

/**
 * DMs a Slack user. `chat.postMessage` to a user id opens the DM implicitly,
 * so no separate conversations.open is needed.
 */
export async function sendSlackDm(
  slackUserId: string,
  text: string,
): Promise<SlackResult> {
  if (!slackEnabled) return { ok: false, skipped: true };
  const result = await call<unknown>("chat.postMessage", {
    channel: slackUserId,
    text,
    unfurl_links: false,
    unfurl_media: false,
  });
  return result.ok
    ? { ok: true, channel: slackUserId }
    : { ok: false, error: result.error };
}
