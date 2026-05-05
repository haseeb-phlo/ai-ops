"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const InviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .refine((e) => /@wearephlo\.com$/i.test(e), {
      message: "Email must be a @wearephlo.com address",
    }),
  display_name: z.string().trim().min(1, "Name is required").max(100),
  title: z.string().trim().min(1, "Title is required").max(100),
  team: z.string().trim().min(1, "Team is required").max(100),
});

export type InviteState =
  | { kind: "idle" }
  | { kind: "ok"; email: string }
  | { kind: "error"; message: string };

export async function invitePerson(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can invite people." };
  }

  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    display_name: formData.get("display_name"),
    title: formData.get("title") ?? "",
    team: formData.get("team"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return {
      kind: "error",
      message:
        "Supabase service role isn't configured on the server - can't send invites.",
    };
  }

  // Step 1: upsert the person into the directory using the super-admin's
  // cookie-bound session (RLS allows super_admin writes to public.people).
  const supabase = await createClient();
  const { error: peopleError } = await supabase
    .from("people")
    .upsert(
      {
        email: parsed.data.email,
        display_name: parsed.data.display_name,
        title: parsed.data.title,
        team: parsed.data.team,
      },
      { onConflict: "email" },
    );

  if (peopleError) {
    return {
      kind: "error",
      message: `Could not save directory entry: ${peopleError.message}`,
    };
  }

  // Step 2: send the Supabase Auth invite email. Service role is required
  // for auth.admin.* APIs but we never use it against public schema tables
  // (those are RLS-protected and need a real super-admin JWT).
  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(parsed.data.email);

  revalidatePath("/map");
  revalidatePath("/admin");

  if (inviteError) {
    const msg = inviteError.message ?? "";
    const alreadyRegistered =
      /already.*(registered|exists)|user.*registered/i.test(msg);

    if (alreadyRegistered) {
      // Already in auth.users — directory entry was still updated, which is
      // valuable on its own. Surface as a soft success rather than an error.
      return {
        kind: "ok",
        email: parsed.data.email,
      };
    }

    return {
      kind: "error",
      message: `Directory updated, but invite email failed: ${msg}`,
    };
  }

  return { kind: "ok", email: parsed.data.email };
}
