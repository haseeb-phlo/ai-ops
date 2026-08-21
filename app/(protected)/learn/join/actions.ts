"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { findLeadEmail } from "@/lib/programme/org-lead";

/**
 * Self-enrolment by join code.
 *
 * The code is an enrolment convenience, not a security boundary - everyone who
 * reaches this page is already an authenticated @wearephlo.com user, so the
 * worst a shared code does is add a colleague to a training cohort. What it
 * buys is a real cohort row (start date, sessions, roster, reporting) without
 * an admin typing out a name list.
 */

const JoinSchema = z.object({
  code: z.string().trim().min(3).max(32),
});

export type JoinState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; cohortId: string; already: boolean };

const REASON_MESSAGE: Record<string, string> = {
  unknown_code:
    "That code doesn't match an open cohort. Check it with whoever invited you.",
  already_in_a_cohort:
    "You're already on a cohort. Finish that one before joining another.",
  not_signed_in: "Your session expired — sign in again.",
};

export async function joinCohort(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = JoinSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { kind: "error", message: "Enter the code you were given." };
  }

  const supabase = await createClient();

  // Default the sign-off route from the org tree. An admin can change it on
  // the roster; getting it roughly right beats leaving every new member
  // unassigned and silently un-signoff-able.
  const { data: person } = await supabase
    .from("people")
    .select("team")
    .ilike("email", user.email)
    .maybeSingle<{ team: string | null }>();

  const leadEmail = findLeadEmail(user.email, person?.team ?? null);
  let leadUserId: string | null = null;
  if (leadEmail && leadEmail !== user.email.toLowerCase()) {
    const { data: resolved } = await supabase.rpc("user_id_for_email", {
      p_email: leadEmail,
    });
    if (typeof resolved === "string") leadUserId = resolved;
  }

  const { data, error } = await supabase.rpc("join_programme_cohort", {
    p_join_code: parsed.data.code,
    p_team_lead_user_id: leadUserId,
  });

  if (error) {
    return { kind: "error", message: `Could not join: ${error.message}` };
  }

  const result = data as
    | { ok: boolean; reason?: string; cohort_id?: string; already?: boolean }
    | null;

  if (!result?.ok) {
    return {
      kind: "error",
      message:
        REASON_MESSAGE[result?.reason ?? ""] ?? "Could not join that cohort.",
    };
  }

  revalidatePath("/learn");
  revalidatePath("/learn/track");
  revalidatePath("/learn/admin");

  return {
    kind: "success",
    cohortId: result.cohort_id ?? "",
    already: result.already === true,
  };
}
