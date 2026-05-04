"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionUser, ROLES, VIEW_AS_COOKIE } from "@/lib/auth";

export async function setViewAs(role: string, team: string | null) {
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    return { error: "Only super admins can switch view-as." };
  }
  if (!(ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid role." };
  }

  const store = await cookies();
  store.set(VIEW_AS_COOKIE, JSON.stringify({ role, team }), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearViewAs() {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}
