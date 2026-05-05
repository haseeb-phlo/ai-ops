/**
 * One-off: sends a "you're now AI Champion" email using the same content
 * the assignChampion server action would. Run with:
 *
 *   node --env-file=.env --import tsx scripts/send-test-champion-email.ts
 *
 * Adjust `to` / `team` / `assignedByName` below as needed.
 */
import { Resend } from "resend";

const TO = process.env.TEST_TO ?? "haseeb.hamid@wearephlo.com";
const TEAM = process.env.TEST_TEAM ?? "Tech";
const RECIPIENT_NAME = process.env.TEST_NAME ?? "Haseeb";
const ASSIGNED_BY = process.env.TEST_ASSIGNED_BY ?? "Phlo Admin";
const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:3000";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "Phlo AI Ops <onboarding@resend.dev>";
  const profileUrl = `${APP_URL.replace(/\/+$/, "")}/champions/${encodeURIComponent(TEAM)}`;
  const firstName = RECIPIENT_NAME.split(" ")[0] || RECIPIENT_NAME;

  const subject = `You're now AI Champion of ${TEAM}`;
  const text = [
    `Hi ${firstName},`,
    "",
    `${ASSIGNED_BY} just made you the AI Champion of ${TEAM} on Phlo AI Ops.`,
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
        <strong>${escapeHtml(ASSIGNED_BY)}</strong> just made you the
        <strong>AI Champion of ${escapeHtml(TEAM)}</strong> on Phlo AI Ops.
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

  console.log(`Sending test email to ${TO} from ${from} ...`);
  const result = await resend.emails.send({
    from,
    to: TO,
    subject,
    html,
    text,
  });

  if (result.error) {
    console.error("FAILED:", result.error);
    process.exitCode = 1;
    return;
  }
  console.log("OK:", result.data?.id ?? "(no id)");
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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
