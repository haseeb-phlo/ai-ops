"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeRejected, parseRoster } from "@/lib/programme/enrolment";

/**
 * Adding people to, and taking people off, the hackathon's guest list.
 *
 * Paste-a-roster rather than a picker, and `parseRoster` rather than a new
 * parser, for the reason the cohort enrolment action gives: the list arrives
 * from a Slack message, a spreadsheet column or an Outlook To: field, and
 * retyping it is how three people get left out. Rejected tokens are reported
 * rather than dropped - silently ignoring a typo is how somebody misses the
 * day.
 *
 * Super admin only, on the REAL role: `requireWriter()` blocks the write
 * while impersonating, and the check below is what stops an ordinary member
 * who finds the endpoint from inviting themselves. The table's policy says
 * the same thing a third time.
 */

export type RosterState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const AddSchema = z.object({ emails: z.string().min(1).max(20_000) });
const RemoveSchema = z.object({ id: z.string().uuid() });

export async function addParticipants(
  _prev: RosterState,
  formData: FormData,
): Promise<RosterState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only a super admin can change the list." };
  }

  const parsed = AddSchema.safeParse({ emails: formData.get("emails") });
  if (!parsed.success) {
    return { kind: "error", message: "Paste at least one address." };
  }

  const { emails, rejected } = parseRoster(parsed.data.emails);
  if (emails.length === 0) {
    return {
      kind: "error",
      message: rejected.length
        ? `No usable addresses. ${describeRejected(rejected)}`
        : "No usable addresses.",
    };
  }

  const supabase = await createClient();
  // ignoreDuplicates so re-pasting a list that already includes half the room
  // adds the other half rather than failing on the unique index.
  const { error } = await supabase
    .from("hackathon_participants")
    .upsert(
      emails.map((email) => ({ email, added_by: gate.user.id })),
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  revalidatePath("/hackathon");
  revalidatePath("/hackathon/problems");
  return {
    kind: "success",
    message: `${emails.length} ${emails.length === 1 ? "address" : "addresses"} on the list.${
      rejected.length ? ` ${describeRejected(rejected)}` : ""
    }`,
  };
}

export async function removeParticipant(
  _prev: RosterState,
  formData: FormData,
): Promise<RosterState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only a super admin can change the list." };
  }

  const parsed = RemoveSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { kind: "error", message: "That person was not on the list." };
  }

  // Their answer is deliberately left in the bank. Taking somebody off the
  // list closes the door; it does not retract a problem the company has
  // already been told about, and deleting it would also renumber everyone
  // else's reading of the shortlist.
  const supabase = await createClient();
  const { error } = await supabase
    .from("hackathon_participants")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return { kind: "error", message: `Could not remove: ${error.message}` };
  }

  revalidatePath("/hackathon");
  revalidatePath("/hackathon/problems");
  return { kind: "success", message: "Removed." };
}
