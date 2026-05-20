import "server-only";
import { cookies } from "next/headers";

export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";

export async function readSidebarCollapsed(): Promise<boolean> {
  const store = await cookies();
  return store.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
}
