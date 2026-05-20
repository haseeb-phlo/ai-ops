import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSidebarCollapsed } from "@/lib/sidebar";
import { Sidebar } from "./_components/sidebar";
import { MobileTopBar } from "./_components/mobile-top-bar";
import { ImpersonationBanner } from "./_components/impersonation-banner";
import { CommandPalette } from "./_components/command-palette";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, sidebarCollapsed] = await Promise.all([
    getSessionUser(),
    readSidebarCollapsed(),
  ]);

  let teams: string[] = [];
  if (user.realRole === "super_admin") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflows")
      .select("team")
      .is("deleted_at", null)
      .not("team", "is", null);
    teams = Array.from(
      new Set((data ?? []).map((r) => r.team).filter(Boolean) as string[]),
    ).sort();
  }

  const canSeeAdmin = user.role === "super_admin";

  return (
    <CommandPalette canSeeAdmin={canSeeAdmin}>
      <div className="flex min-h-full flex-1">
        <Sidebar
          user={user}
          canSeeAdmin={canSeeAdmin}
          initialCollapsed={sidebarCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar canSeeAdmin={canSeeAdmin} />
          <ImpersonationBanner user={user} teams={teams} />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </CommandPalette>
  );
}
