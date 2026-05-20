"use server";

import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar";

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const store = await cookies();
  store.set(SIDEBAR_COLLAPSED_COOKIE, collapsed ? "1" : "0", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
