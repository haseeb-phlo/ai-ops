import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSidebarCollapsed } from "@/lib/sidebar";
import { loadImpersonableUsers, type ImpersonableUser } from "@/lib/impersonable-users";
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
  let impersonableUsers: ImpersonableUser[] = [];
  if (user.realRole === "super_admin") {
    const supabase = await createClient();
    const [teamsRes, users] = await Promise.all([
      supabase
        .from("workflows")
        .select("team")
        .is("deleted_at", null)
        .not("team", "is", null),
      loadImpersonableUsers(),
    ]);
    teams = Array.from(
      new Set(
        (teamsRes.data ?? []).map((r) => r.team).filter(Boolean) as string[],
      ),
    ).sort();
    impersonableUsers = users;
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
          <MobileTopBar user={user} canSeeAdmin={canSeeAdmin} />
          <ImpersonationBanner
            user={user}
            teams={teams}
            impersonableUsers={impersonableUsers}
          />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </CommandPalette>
  );
}
