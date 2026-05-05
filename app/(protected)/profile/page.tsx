import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPeopleTeams } from "@/lib/teams";
import { findChampionForPerson } from "@/lib/champions";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfilePage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  // The People page is the canonical source of teams — anything not in
  // people.team is intentionally excluded so members can't pick a team that
  // org-structurally doesn't exist.
  const teams = await loadPeopleTeams(supabase, user.team);

  const champion = await findChampionForPerson({
    userId: user.id,
    displayName: user.displayName,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Your profile"
        description="Your name, photo, and team are shown across the app and on the company map."
      />

      {champion && (
        <Link
          href={`/champions/${encodeURIComponent(champion.team)}`}
          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <span>
            <span aria-hidden className="mr-1.5">⚡</span>
            You&apos;re the AI Champion of <strong>{champion.team}</strong>.
            Edit your blurb and check in here.
          </span>
          <span className="text-xs font-medium">Open champion page →</span>
        </Link>
      )}

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
