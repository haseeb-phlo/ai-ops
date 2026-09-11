import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSidebarCollapsed } from "@/lib/sidebar";
import { loadImpersonableUsers, type ImpersonableUser } from "@/lib/impersonable-users";
import { canSeeHackathon, hackathonAccess } from "@/lib/hackathon/access";
import { loadHackathonInvite } from "@/lib/hackathon/state";
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

  // Whether the Hackathon tab exists for this viewer. A super admin gets it
  // unconditionally, which is also the one case that needs no query - so the
  // only people this costs a lookup are the invitees it is actually about,
  // and `loadHackathonInvite` is cache()d, so the /hackathon pages reuse it.
  const hackathonVisible = canSeeHackathon(
    hackathonAccess({
      isParticipant:
        user.realRole === "super_admin"
          ? false
          : (await loadHackathonInvite(user.email)).isParticipant,
      // Irrelevant to visibility: the tab is how you reach the survey, so it
      // cannot depend on having answered it.
      hasResponded: false,
      realRole: user.realRole,
    }),
  );

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
    <CommandPalette canSeeAdmin={canSeeAdmin} canSeeHackathon={hackathonVisible}>
      <div className="flex min-h-full flex-1">
        <Sidebar
          user={user}
          canSeeAdmin={canSeeAdmin}
          canSeeHackathon={hackathonVisible}
          initialCollapsed={sidebarCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar
            user={user}
            canSeeAdmin={canSeeAdmin}
            canSeeHackathon={hackathonVisible}
          />
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
