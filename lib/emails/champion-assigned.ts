import "server-only";
import { resend, EMAIL_FROM } from "@/lib/resend";

type SendChampionAssignedArgs = {
  to: string;
  recipientName: string;
  team: string;
  assignedByName: string;
};

// Phlo brand. Mirrors the in-app lockup so the email and the product feel
// like the same surface.
const PHLO_NAVY = "#07073D";
const PHLO_LOGO_URL =
  "https://cdn.prod.website-files.com/5d27595e2836ca3889cdbc80/631ef2c8eabdf645c82dd08f_phlo-logo-isolated-01.svg";

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
}: SendChampionAssignedArgs): Promise<
  | { ok: true; id: string | null }
  | { ok: false; message: string }
  | { skipped: true }
> {
  if (!resend) return { skipped: true };

  const firstName = recipientName.split(" ")[0] || recipientName;

  const subject = `You're now AI Champion of ${team}`;
  const text = [
    `Hi ${firstName},`,
    "",
    `${assignedByName} has made you the AI Champion of ${team} on Phlo AI Ops.`,
    "",
    "What that means:",
    "  - Help triage AI suggestions that touch your team's work.",
    "  - Edit AI initiatives that affect your team's workflows.",
    "  - Sign off on workflow changes for your team.",
    "",
    "- Phlo AI Ops",
  ].join("\n");

  const html = `
    <div style="background:#f4f5f8;padding:24px;font-family:'Inter Tight',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="padding:24px 28px 0 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;">
                  <img
                    src="${PHLO_LOGO_URL}"
                    alt="Phlo"
                    width="64"
                    height="22"
                    style="display:block;border:0;"
                  />
                </td>
                <td style="border-left:1px solid #d4d4d8;height:18px;width:1px;"></td>
                <td style="padding-left:10px;font-size:13px;font-weight:500;letter-spacing:-0.01em;color:${PHLO_NAVY};">
                  AI Ops
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 4px 28px;">
            <h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.015em;color:${PHLO_NAVY};line-height:1.3;">
              You&rsquo;re the new AI Champion of ${escapeHtml(team)}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px;color:#3f3f46;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 12px 0;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 16px 0;">
              <strong style="color:${PHLO_NAVY};">${escapeHtml(assignedByName)}</strong>
              has made you the AI Champion of
              <strong style="color:${PHLO_NAVY};">${escapeHtml(team)}</strong>
              on Phlo AI Ops &mdash; the editorial voice for AI on your team.
            </p>
            <p style="margin:16px 0 8px 0;font-weight:600;color:${PHLO_NAVY};">What you do as champion:</p>
            <ul style="padding-left:20px;margin:0 0 4px 0;">
              <li style="margin-bottom:6px;">Help triage AI suggestions that touch your team&rsquo;s work.</li>
              <li style="margin-bottom:6px;">Edit AI initiatives that affect your team&rsquo;s workflows.</li>
              <li style="margin-bottom:6px;">Sign off on workflow changes for your team.</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px 28px;">
            <hr style="border:0;border-top:1px solid #e4e4e7;margin:0 0 16px 0;" />
            <p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">
              Phlo AI Ops &middot; Phlo&rsquo;s internal register of recurring workflows and AI interventions.
            </p>
          </td>
        </tr>
      </table>
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
