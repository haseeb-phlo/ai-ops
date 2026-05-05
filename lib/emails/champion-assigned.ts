import "server-only";
import { resend, EMAIL_FROM } from "@/lib/resend";

type SendChampionAssignedArgs = {
  to: string;
  recipientName: string;
  team: string;
  assignedByName: string;
  appUrl: string;
};

/**
 * Sends a "you have been made an AI Champion" email. No-ops (returns
 * `{ skipped: true }`) if Resend isn't configured, so a missing API key
 * never blocks the assignment itself.
 */
export async function sendChampionAssignedEmail({
  to,
  recipientName,
  team,
  assignedByName,
  appUrl,
}: SendChampionAssignedArgs): Promise<
  | { ok: true; id: string | null }
  | { ok: false; message: string }
  | { skipped: true }
> {
  if (!resend) return { skipped: true };

  const profileUrl = `${appUrl.replace(/\/+$/, "")}/champions/${encodeURIComponent(team)}`;
  const firstName = recipientName.split(" ")[0] || recipientName;

  const subject = `You're now AI Champion of ${team}`;
  const text = [
    `Hi ${firstName},`,
    "",
    `${assignedByName} just made you the AI Champion of ${team} on Phlo AI Ops.`,
    "",
    "What that means:",
    "  - You're the editorial voice for your team's workflows and interventions.",
    "  - You can leave champion notes (yellow callouts) on workflows + interventions.",
    "  - You can co-sign interventions to vouch for them.",
    "  - You can edit your own profile blurb and what you're chewing on.",
    "",
    `Your champion page: ${profileUrl}`,
    "",
    "Drop in to add a blurb so the rest of the company knows what you're focused on.",
    "",
    "- Phlo AI Ops",
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #18181b; line-height: 1.55;">
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>
        <strong>${escapeHtml(assignedByName)}</strong> just made you the
        <strong>AI Champion of ${escapeHtml(team)}</strong> on Phlo AI Ops.
      </p>
      <p style="margin: 16px 0 8px 0;"><strong>What that means:</strong></p>
      <ul style="padding-left: 20px; margin: 0 0 16px 0;">
        <li>You're the editorial voice for your team's workflows and interventions.</li>
        <li>You can leave champion notes (yellow callouts) on workflows + interventions.</li>
        <li>You can co-sign interventions to vouch for them.</li>
        <li>You can edit your own profile blurb and what you're chewing on.</li>
      </ul>
      <p style="margin: 24px 0;">
        <a
          href="${escapeAttr(profileUrl)}"
          style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;"
        >Open your champion page</a>
      </p>
      <p style="color:#52525b;font-size:14px;">
        Drop in to add a blurb so the rest of the company knows what you're focused on.
      </p>
      <p style="color:#a1a1aa;font-size:12px;margin-top:32px;">- Phlo AI Ops</p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    if (result.error) {
      return { ok: false, message: result.error.message };
    }
    return { ok: true, id: result.data?.id ?? null };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
