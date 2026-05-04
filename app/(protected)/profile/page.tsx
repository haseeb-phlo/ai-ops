import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPeopleTeams } from "@/lib/teams";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfilePage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  // The People page is the canonical source of teams — anything not in
  // people.team is intentionally excluded so members can't pick a team that
  // org-structurally doesn't exist.
  const teams = await loadPeopleTeams(supabase, user.team);

  return (
    <PageContainer>
      <PageHeader
        title="Your profile"
        description="Your name, photo, and team are shown across the app and on the company map."
      />

      <div className="max-w-xl">
        <ProfileForm
          defaultDisplayName={user.displayName}
          defaultAvatarUrl={user.avatarUrl}
          defaultTitle={user.title ?? ""}
          defaultTeam={user.team}
          email={user.email}
          userId={user.id}
          teams={teams}
        />
      </div>
    </PageContainer>
  );
}
