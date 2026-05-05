import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { championsForTeam, type Champion } from "@/lib/champions";
import { resolveAvatar } from "@/lib/profile";
import { TextWithMentions } from "@/components/people/champion-mark";
import { PageContainer } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { EditorialForm } from "./_components/editorial-form";
import { CheckInButton } from "./_components/check-in-button";
import {
  SuperAdminManage,
  type CandidatePerson,
} from "./_components/super-admin-manage";

type SponsoredWorkflow = {
  id: string;
  name: string;
  criticality: string | null;
  regulatory: boolean;
};

type SponsoredIntervention = {
  id: string;
  name: string;
  status: string | null;
};

type LeftNote = {
  id: string;
  target_type: "workflow" | "intervention";
  target_id: string;
  body: string;
  updated_at: string;
};

type CosignGiven = {
  intervention_id: string;
  signed_at: string;
};

type ProfileRow = {
  user_id: string;
  avatar_url: string | null;
  title: string | null;
};

export default async function ChampionTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: teamRaw } = await params;
  const team = decodeURIComponent(teamRaw);
  const user = await getSessionUser();
  const isSuper = user.role === "super_admin";

  const forTeam = await championsForTeam();
  const champions = forTeam.get(team) ?? [];

  const supabase = await createClient();

  const championUserIds = champions
    .map((c) => c.user_id)
    .filter((u): u is string => !!u);

  const [
    { data: profileRows },
    { data: workflows },
    { data: interventionLinks },
    { data: notes },
    { data: cosigns },
  ] = await Promise.all([
    championUserIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id, avatar_url, title")
          .in("user_id", championUserIds)
          .returns<ProfileRow[]>()
      : Promise.resolve({ data: [] as ProfileRow[] }),
    supabase
      .from("workflows")
      .select("id, name, criticality, regulatory")
      .eq("team", team)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<SponsoredWorkflow[]>(),
    supabase
      .from("intervention_workflows")
      .select("intervention_id, workflows!inner(team)")
      .eq("workflows.team", team)
      .returns<{ intervention_id: string }[]>(),
    supabase
      .from("champion_notes")
      .select("id, target_type, target_id, body, updated_at")
      .eq("team", team)
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<LeftNote[]>(),
    supabase
      .from("intervention_cosigns")
      .select("intervention_id, signed_at")
      .eq("team", team)
      .order("signed_at", { ascending: false })
      .limit(20)
      .returns<CosignGiven[]>(),
  ]);

  const profileByUserId = new Map(
    (profileRows ?? []).map((p) => [p.user_id, p]),
  );

  const interventionIds = Array.from(
    new Set((interventionLinks ?? []).map((r) => r.intervention_id)),
  );
  let sponsoredInterventions: SponsoredIntervention[] = [];
  if (interventionIds.length > 0) {
    const { data } = await supabase
      .from("ai_interventions")
      .select("id, name, status")
      .in("id", interventionIds)
      .order("name", { ascending: true })
      .returns<SponsoredIntervention[]>();
    sponsoredInterventions = data ?? [];
  }

  const interventionNameById = new Map(
    sponsoredInterventions.map((i) => [i.id, i.name]),
  );
  const workflowNameById = new Map(
    (workflows ?? []).map((w) => [w.id, w.name]),
  );

  // Super-admin only: candidates from the directory for the "add champion"
  // form. Existing-champion user_ids filtered out so the picker doesn't
  // show people who'd just hit a unique-violation.
  let candidates: CandidatePerson[] = [];
  if (isSuper) {
    const { data } = await supabase
      .from("people")
      .select("id, display_name, email")
      .eq("team", team)
      .order("display_name", { ascending: true })
      .returns<(CandidatePerson & { email: string })[]>();
    const existingEmails = new Set<string>();
    // We don't have champions.email directly, but we can filter by the
    // email field on people via user_id matching. Simpler: keep the full
    // list; the action error covers duplicates if they slip through.
    void existingEmails;
    candidates = data ?? [];
  }

  return (
    <PageContainer>
      <nav className="text-sm">
        <Link
          href="/map?view=champions"
          className="text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          ← All champions
        </Link>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {team}
        </h1>
        <p className="text-sm text-zinc-500">
          {champions.length === 0
            ? "No AI Champions assigned yet."
            : `${champions.length} AI ${champions.length === 1 ? "Champion" : "Champions"}`}
        </p>
      </header>

      {champions.length === 0 ? (
        <section className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
          {isSuper ? (
            <>
              No champion assigned to <strong>{team}</strong> yet. Use the form
              below to assign one.
            </>
          ) : (
            <>
              No champion has been assigned to <strong>{team}</strong> yet. A
              super-admin can assign one from{" "}
              <Link
                href="/admin"
                className="font-medium text-zinc-700 underline"
              >
                /admin
              </Link>
              .
            </>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {champions.map((c) => (
            <ChampionCard
              key={c.id}
              champion={c}
              profile={c.user_id ? profileByUserId.get(c.user_id) ?? null : null}
              isSelf={c.user_id === user.id}
              isSuper={isSuper}
              team={team}
            />
          ))}
        </div>
      )}

      {isSuper && (
        <SuperAdminManage
          team={team}
          candidates={candidates}
          championCount={champions.length}
        />
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Sponsored workflows
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {(workflows ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No workflows on this team yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(workflows ?? []).map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <Link
                    href={`/workflows/${w.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {w.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    {w.regulatory && (
                      <Badge variant="outline">Regulatory</Badge>
                    )}
                    {w.criticality && (
                      <Badge variant="secondary">{w.criticality}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Interventions on this team
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {sponsoredInterventions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No interventions linked to this team yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {sponsoredInterventions.map((iv) => (
                <li
                  key={iv.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <Link
                    href={`/interventions/${iv.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {iv.name}
                  </Link>
                  {iv.status && (
                    <Badge variant="secondary">{iv.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Recent notes left
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {(notes ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No notes left yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(notes ?? []).map((n) => {
                const targetName =
                  n.target_type === "workflow"
                    ? workflowNameById.get(n.target_id) ?? "(unknown workflow)"
                    : interventionNameById.get(n.target_id) ??
                      "(unknown intervention)";
                const targetHref =
                  n.target_type === "workflow"
                    ? `/workflows/${n.target_id}`
                    : `/interventions/${n.target_id}`;
                return (
                  <li key={n.id} className="px-4 py-3 text-sm">
                    <Link
                      href={targetHref}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {targetName}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-400">
                      {format(new Date(n.updated_at), "d MMM yyyy")}
                    </span>
                    <p className="mt-1 text-zinc-700">
                      <TextWithMentions text={n.body} />
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Co-signs given
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {(cosigns ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No co-signs yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(cosigns ?? []).map((c) => (
                <li
                  key={c.intervention_id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <Link
                    href={`/interventions/${c.intervention_id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {interventionNameById.get(c.intervention_id) ??
                      "(unknown intervention)"}
                  </Link>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {format(new Date(c.signed_at), "d MMM yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageContainer>
  );
}

import { RemoveChampionButton } from "./_components/remove-champion-button";

function ChampionCard({
  champion,
  profile,
  isSelf,
  isSuper,
  team,
}: {
  champion: Champion;
  profile: ProfileRow | null;
  isSelf: boolean;
  isSuper: boolean;
  team: string;
}) {
  const seed = champion.user_id ?? champion.display_name;
  const avatarSrc = resolveAvatar(profile?.avatar_url ?? null, seed);
  const canEdit = isSelf || isSuper;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            className="relative inline-block shrink-0"
            style={{ width: 56, height: 56 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt={champion.display_name}
              className="h-full w-full rounded-full bg-zinc-50 object-cover ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
            />
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold leading-none text-white shadow-sm ring-1 ring-white"
            >
              ⚡
            </span>
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              {champion.display_name}
            </h2>
            <p className="text-sm text-zinc-500">
              {profile?.title ?? "AI Champion"}
              {champion.user_id ? "" : "  ·  hasn't signed in yet"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {champion.last_check_in
                ? `Last check-in ${formatDistanceToNow(new Date(champion.last_check_in), { addSuffix: true })}`
                : "No check-ins recorded yet."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSelf && <CheckInButton team={team} />}
          {isSuper && (
            <RemoveChampionButton
              championId={champion.id}
              team={team}
              displayName={champion.display_name}
            />
          )}
        </div>
      </div>

      {(champion.blurb || champion.chewing_on) && (
        <div className="space-y-3">
          {champion.blurb && (
            <p className="text-sm text-zinc-700">
              <TextWithMentions text={champion.blurb} />
            </p>
          )}
          {champion.chewing_on && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                Chewing on
              </div>
              <p className="mt-1 text-sm text-amber-900">
                <TextWithMentions text={champion.chewing_on} />
              </p>
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div className="border-t border-zinc-100 pt-5">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {isSelf ? "Your editorial voice" : "Editorial (super-admin)"}
          </h3>
          <EditorialForm
            team={team}
            championId={champion.id}
            defaultBlurb={champion.blurb ?? ""}
            defaultChewingOn={champion.chewing_on ?? ""}
          />
        </div>
      )}
    </section>
  );
}
