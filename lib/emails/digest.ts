import "server-only";
import { resend, EMAIL_FROM } from "@/lib/resend";

const PHLO_NAVY = "#07073D";
const PHLO_CYAN = "#46C1D1";
const PHLO_LOGO_URL =
  "https://cdn.prod.website-files.com/5d27595e2836ca3889cdbc80/631ef2c8eabdf645c82dd08f_phlo-logo-isolated-01.svg";

export type DigestTopWin = {
  name: string;
  team: string | null;
  weeklyGbp: number;
  weeklyMinutes: number;
  href: string;
};

export type DigestSuggestion = {
  title: string;
  team: string | null;
  voteCount: number;
  href: string;
};

export type DigestVideo = {
  title: string;
  href: string;
};

export type DigestPersonal = {
  initiativesShipped: number;
  suggestionsSubmitted: number;
  commentsPosted: number;
  videosWatched: number;
};

type SendDigestArgs = {
  recipient: { email: string; displayName: string };
  periodLabel: string; // e.g. "5 May → 19 May 2026"
  appUrl: string;
  personal: DigestPersonal;
  topWins: DigestTopWin[];
  suggestionsNeedingVotes: DigestSuggestion[];
  unwatchedVideos: DigestVideo[];
};

/**
 * Sends one fortnightly digest. The caller is responsible for picking the
 * window and composing the per-recipient content; this function only
 * formats and ships the email.
 *
 * No-ops if Resend isn't configured (dev). Returns a discriminated result
 * so the cron can log per-recipient outcomes without crashing on one bad
 * send.
 */
export async function sendDigestEmail(
  args: SendDigestArgs,
): Promise<
  | { ok: true; id: string | null }
  | { ok: false; message: string }
  | { skipped: true }
> {
  if (!resend) return { skipped: true };

  const firstName =
    args.recipient.displayName.split(" ")[0] || args.recipient.displayName;
  const subject = `Phlo AI Ops · Your fortnight in review (${args.periodLabel})`;

  const text = [
    `Hi ${firstName},`,
    "",
    `Here's what happened in Phlo AI Ops over ${args.periodLabel}:`,
    "",
    "Your contribution:",
    `  · ${args.personal.initiativesShipped} initiatives logged`,
    `  · ${args.personal.suggestionsSubmitted} suggestions submitted`,
    `  · ${args.personal.commentsPosted} comments posted`,
    `  · ${args.personal.videosWatched} learn videos watched`,
    "",
    args.topWins.length === 0
      ? ""
      : "Top wins:\n" +
        args.topWins
          .map(
            (w, i) =>
              `  ${i + 1}. ${w.name}${w.team ? ` (${w.team})` : ""} - £${Math.round(w.weeklyGbp).toLocaleString()}/wk + ${Math.round(w.weeklyMinutes).toLocaleString()} min/wk`,
          )
          .join("\n") +
        "\n",
    args.suggestionsNeedingVotes.length === 0
      ? ""
      : "Suggestions needing votes:\n" +
        args.suggestionsNeedingVotes
          .map(
            (s) =>
              `  · ${s.title}${s.team ? ` (${s.team})` : ""} - ${s.voteCount} votes`,
          )
          .join("\n") +
        "\n",
    args.unwatchedVideos.length === 0
      ? ""
      : "New learn videos:\n" +
        args.unwatchedVideos.map((v) => `  · ${v.title}`).join("\n") +
        "\n",
    `Open the dashboard: ${args.appUrl}`,
    "",
    "- Phlo AI Ops",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderHtml({ ...args, firstName });

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.recipient.email,
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

function renderHtml(args: SendDigestArgs & { firstName: string }): string {
  const personal = args.personal;
  const personalEmpty =
    personal.initiativesShipped +
      personal.suggestionsSubmitted +
      personal.commentsPosted +
      personal.videosWatched ===
    0;
  return `
    <div style="background:#f4f5f8;padding:24px;font-family:'Inter Tight',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="padding:24px 28px 0 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;">
                  <img src="${PHLO_LOGO_URL}" alt="Phlo" width="64" height="22" style="display:block;border:0;" />
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
            <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.015em;color:${PHLO_NAVY};line-height:1.3;">
              Hi ${escapeHtml(args.firstName)} - your fortnight in review
            </h1>
            <p style="margin:8px 0 0 0;font-size:13px;color:#71717a;">
              ${escapeHtml(args.periodLabel)}
            </p>
          </td>
        </tr>

        ${
          personalEmpty
            ? ""
            : `
        <tr>
          <td style="padding:20px 28px 4px 28px;">
            <h2 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;font-weight:600;">
              Your contribution
            </h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;">
              <tr>
                ${tile("Initiatives", personal.initiativesShipped)}
                ${tile("Suggestions", personal.suggestionsSubmitted)}
                ${tile("Comments", personal.commentsPosted)}
                ${tile("Videos", personal.videosWatched)}
              </tr>
            </table>
          </td>
        </tr>`
        }

        ${
          args.topWins.length === 0
            ? ""
            : `
        <tr>
          <td style="padding:20px 28px 4px 28px;">
            <h2 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;font-weight:600;">
              Top wins
            </h2>
            <ol style="margin:0;padding-left:20px;color:#3f3f46;font-size:14px;line-height:1.6;">
              ${args.topWins
                .map(
                  (w) => `
                <li style="margin-bottom:6px;">
                  <a href="${escapeAttr(w.href)}" style="color:${PHLO_NAVY};text-decoration:none;font-weight:600;">${escapeHtml(w.name)}</a>
                  ${w.team ? `<span style="color:#71717a;">· ${escapeHtml(w.team)}</span>` : ""}
                  <br />
                  <span style="color:#71717a;font-size:13px;">
                    £${Math.round(w.weeklyGbp).toLocaleString()}/wk + ${Math.round(w.weeklyMinutes).toLocaleString()} min/wk
                  </span>
                </li>`,
                )
                .join("")}
            </ol>
          </td>
        </tr>`
        }

        ${
          args.suggestionsNeedingVotes.length === 0
            ? ""
            : `
        <tr>
          <td style="padding:20px 28px 4px 28px;">
            <h2 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;font-weight:600;">
              Suggestions needing your vote
            </h2>
            <ul style="margin:0;padding-left:20px;color:#3f3f46;font-size:14px;line-height:1.6;">
              ${args.suggestionsNeedingVotes
                .map(
                  (s) => `
                <li style="margin-bottom:6px;">
                  <a href="${escapeAttr(s.href)}" style="color:${PHLO_NAVY};text-decoration:none;font-weight:600;">${escapeHtml(s.title)}</a>
                  ${s.team ? `<span style="color:#71717a;">· ${escapeHtml(s.team)}</span>` : ""}
                  <span style="color:#71717a;font-size:13px;"> · ${s.voteCount} votes</span>
                </li>`,
                )
                .join("")}
            </ul>
          </td>
        </tr>`
        }

        ${
          args.unwatchedVideos.length === 0
            ? ""
            : `
        <tr>
          <td style="padding:20px 28px 4px 28px;">
            <h2 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;font-weight:600;">
              New learn videos for you
            </h2>
            <ul style="margin:0;padding-left:20px;color:#3f3f46;font-size:14px;line-height:1.6;">
              ${args.unwatchedVideos
                .map(
                  (v) => `
                <li style="margin-bottom:6px;">
                  <a href="${escapeAttr(v.href)}" style="color:${PHLO_NAVY};text-decoration:none;font-weight:600;">${escapeHtml(v.title)}</a>
                </li>`,
                )
                .join("")}
            </ul>
          </td>
        </tr>`
        }

        <tr>
          <td style="padding:24px 28px 24px 28px;">
            <a href="${escapeAttr(args.appUrl)}" style="display:inline-block;background:${PHLO_CYAN};color:${PHLO_NAVY};text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600;font-size:14px;letter-spacing:-0.005em;">
              Open the dashboard
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px 28px;">
            <hr style="border:0;border-top:1px solid #e4e4e7;margin:0 0 16px 0;" />
            <p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">
              Phlo AI Ops &middot; You're receiving this fortnightly digest because you have a Phlo workshop account.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function tile(label: string, value: number): string {
  return `
    <td style="width:25%;padding:12px;text-align:center;border-right:1px solid #e4e4e7;background:#fafafa;">
      <p style="margin:0;font-size:22px;font-weight:600;color:${PHLO_NAVY};line-height:1;">
        ${value.toLocaleString()}
      </p>
      <p style="margin:6px 0 0 0;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;">
        ${escapeHtml(label)}
      </p>
    </td>
  `;
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
