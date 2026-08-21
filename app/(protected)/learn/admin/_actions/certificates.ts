"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWriter } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { resolveDisplayName } from "@/lib/profile";
import {
  certificateAnnouncementText,
  certificateIssuedText,
} from "@/lib/programme/messages";
import {
  claimSend,
  firstNameOf,
  notifyChannel,
  notifyPerson,
  recordOutcome,
} from "@/lib/programme/notify";

/**
 * Certificate approval.
 *
 * Meeting all four gates makes a certificate EARNED; an admin approving it
 * makes it ISSUED. Only issuing reveals the certificate to the member and
 * announces it, which gives a human the chance to catch the case where the
 * gates are technically satisfied but the work is not what the programme
 * intended.
 *
 * Announcing on approval rather than on completion also means the cohort
 * channel only ever sees certificates somebody has actually looked at.
 */

export type CertificateActionState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; issued: number; announced: boolean };

const DecideSchema = z.object({
  cohort_member_ids: z.array(z.string().uuid()).min(1).max(200),
  decision: z.enum(["issue", "decline"]),
  note: z.string().trim().max(1000).nullable(),
});

export async function decideCertificates(
  _prev: CertificateActionState,
  formData: FormData,
): Promise<CertificateActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can issue certificates." };
  }

  const parsed = DecideSchema.safeParse({
    cohort_member_ids: formData.getAll("cohort_member_id").map(String),
    decision: formData.get("decision"),
    note: (formData.get("note") as string)?.trim() || null,
  });
  if (!parsed.success) {
    return { kind: "error", message: "Pick at least one person." };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (parsed.data.decision === "decline") {
    const { error } = await supabase
      .from("programme_cohort_members")
      .update({ certificate_declined_at: now, certificate_note: parsed.data.note })
      .in("id", parsed.data.cohort_member_ids)
      .is("certificate_issued_at", null);
    if (error) return { kind: "error", message: `Could not save: ${error.message}` };
    revalidatePath("/learn/admin");
    return { kind: "success", issued: 0, announced: false };
  }

  // Guarded on not-yet-issued, so a double submit cannot announce twice.
  const { data: issued, error } = await supabase
    .from("programme_cohort_members")
    .update({
      certificate_issued_at: now,
      certificate_issued_by: gate.user.id,
      certificate_declined_at: null,
      certificate_note: parsed.data.note,
    })
    .in("id", parsed.data.cohort_member_ids)
    .not("completed_at", "is", null)
    .is("certificate_issued_at", null)
    .select("id, user_id, cohort_id")
    .returns<{ id: string; user_id: string; cohort_id: string }[]>();

  if (error) return { kind: "error", message: `Could not save: ${error.message}` };
  if (!issued || issued.length === 0) {
    return { kind: "error", message: "Nothing to issue - already done, or gates not met." };
  }

  const announced = await announceCertificates(issued);

  revalidatePath("/learn/admin");
  revalidatePath("/learn/track");
  revalidatePath("/learn/leads");
  return { kind: "success", issued: issued.length, announced };
}

/**
 * DMs each recipient and posts one batched message per cohort channel.
 *
 * Uses the service-role client because it reads other people's emails and
 * writes the send log, neither of which a request-scoped client should do.
 * Failures are logged, never thrown: a Slack outage must not roll back an
 * approval that has already been recorded.
 */
async function announceCertificates(
  issued: readonly { id: string; user_id: string; cohort_id: string }[],
): Promise<boolean> {
  const admin = createAdminClient();
  const url = appUrl();
  const day = new Date().toISOString().slice(0, 10);

  const userIds = issued.map((i) => i.user_id);
  const [{ data: emails }, { data: profiles }, { data: cohorts }] =
    await Promise.all([
      admin.rpc("user_emails", { p_user_ids: userIds }),
      admin
        .from("profiles")
        .select("user_id, display_name, slack_user_id")
        .in("user_id", userIds)
        .returns<
          { user_id: string; display_name: string | null; slack_user_id: string | null }[]
        >(),
      admin
        .from("programme_cohorts")
        .select("id, name, slack_channel")
        .in("id", [...new Set(issued.map((i) => i.cohort_id))])
        .returns<{ id: string; name: string; slack_channel: string | null }[]>(),
    ]);

  const emailByUserId = new Map(
    ((emails ?? []) as { user_id: string; email: string | null }[])
      .filter((e) => e.email)
      .map((e) => [e.user_id, e.email!]),
  );
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c]));

  const namesByCohort = new Map<string, string[]>();
  let anyAnnounced = false;

  for (const member of issued) {
    const email = emailByUserId.get(member.user_id);
    const profile = profileByUserId.get(member.user_id);
    const displayName = resolveDisplayName(
      profile?.display_name,
      null,
      email ?? "",
    );
    const cohort = cohortById.get(member.cohort_id);

    namesByCohort.set(member.cohort_id, [
      ...(namesByCohort.get(member.cohort_id) ?? []),
      displayName,
    ]);

    if (!email) continue;

    const claimed = await claimSend(admin, {
      kind: "certificate_issued",
      userId: member.user_id,
      periodKey: member.id,
    });
    if (!claimed) continue;

    const outcome = await notifyPerson({
      supabase: admin,
      recipient: {
        userId: member.user_id,
        email,
        displayName,
        slackUserId: profile?.slack_user_id ?? null,
      },
      subject: "Your Core Programme certificate",
      text: certificateIssuedText({
        firstName: firstNameOf(displayName),
        cohortName: cohort?.name ?? "your cohort",
        certificateUrl: `${url}/learn/track/certificate`,
      }),
    });
    await recordOutcome(admin, {
      kind: "certificate_issued",
      userId: member.user_id,
      periodKey: member.id,
      outcome,
    });
  }

  // One post per cohort per day, batched. Three separate posts is spam.
  for (const [cohortId, names] of namesByCohort) {
    const cohort = cohortById.get(cohortId);
    if (!cohort?.slack_channel) continue;

    const claimed = await claimSend(admin, {
      kind: "cohort_summary",
      userId: null,
      periodKey: `certificates:${cohortId}:${day}`,
      channel: cohort.slack_channel,
    });
    if (!claimed) continue;

    const outcome = await notifyChannel({
      channel: cohort.slack_channel,
      text: certificateAnnouncementText(names),
    });
    if (outcome.ok) anyAnnounced = true;
    await recordOutcome(admin, {
      kind: "cohort_summary",
      userId: null,
      periodKey: `certificates:${cohortId}:${day}`,
      outcome,
    });
  }

  return anyAnnounced;
}
