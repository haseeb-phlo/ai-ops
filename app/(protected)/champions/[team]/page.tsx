import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { championsForTeam, type Champion } from "@/lib/champions";
import { resolveAvatar } from "@/lib/profile";
import { TextWithMentions } from "@/components/people/champion-mark";
import { PageContainer } from "@/components/page-header";
import { DetailHeader } from "@/components/ui/detail-header";
import { Badge } from "@/components/ui/badge";
import { CheckInButton } from "./_components/check-in-button";

type SponsoredWorkflow = {
  id: string;
  name: string;
  criticality_score: number | null;
  regulatory: boolean;
};

const CRITICALITY_LABEL: Record<number, string> = {
  1: "Trivial",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Critical",
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
      .select("id, name, criticality_score, regulatory")
      .eq("team", team)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<SponsoredWorkflow[]>(),
    supabase
      .from("intervention_workflows")
      .select("intervention_id, workflows!inner(team)")
      .eq("workflows.team", team)
      .is("workflows.deleted_at", null)
      .returns<{ intervention_id: string }[]>(),
    supabase
      .from("champion_notes")
      .select("id, target_type, target_id, body, updated_at")
      .eq("team", team)
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<LeftNote[]>(),
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

  return (
    <PageContainer>
      <DetailHeader
        backHref="/map?view=champions"
        backLabel="All champions"
        title={team}
      />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {team}
        </h1>
      </header>

      {/* One-time orientation for a freshly-assigned champion. Disappears
          the moment any team note exists, since the role is exercised
          through notes rather than a static profile. */}
      {champions.some((c) => c.user_id === user.id) &&
        (notes ?? []).length === 0 && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            You&apos;re the AI Champion of <strong>{team}</strong>. Leave
            champion notes on workflows and AI initiatives, and check in
            regularly.
          </p>
        )}

      {champions.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
          No champion has been assigned to <strong>{team}</strong> yet.
          {isSuper ? (
            <>
              {" "}Assign one from the{" "}
              <Link
                href="/admin"
                className="font-medium text-foreground underline"
              >
                Champions tab in /admin
              </Link>
              .
            </>
          ) : (
            <>
              {" "}A super-admin can assign one from{" "}
              <Link
                href="/admin"
                className="font-medium text-foreground underline"
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Sponsored workflows
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {(workflows ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No workflows on this team yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(workflows ?? []).map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <Link
                    href={`/workflows/${w.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {w.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    {w.regulatory && (
                      <Badge variant="outline">Regulatory</Badge>
                    )}
                    {w.criticality_score != null && (
                      <Badge variant="secondary">
                        {CRITICALITY_LABEL[w.criticality_score] ?? "-"}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          AI initiatives on this team
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {sponsoredInterventions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No AI initiatives linked to this team yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sponsoredInterventions.map((iv) => (
                <li
                  key={iv.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <Link
                    href={`/interventions/${iv.id}`}
                    className="font-medium text-foreground hover:underline"
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
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Recent notes left
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {(notes ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No notes left yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(notes ?? []).map((n) => {
                const targetName =
                  n.target_type === "workflow"
                    ? workflowNameById.get(n.target_id) ?? "(unknown workflow)"
                    : interventionNameById.get(n.target_id) ??
                      "(unknown AI initiative)";
                const targetHref =
                  n.target_type === "workflow"
                    ? `/workflows/${n.target_id}`
                    : `/interventions/${n.target_id}`;
                return (
                  <li key={n.id} className="px-4 py-3 text-sm">
                    <Link
                      href={targetHref}
                      className="font-medium text-foreground hover:underline"
                    >
                      {targetName}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {format(new Date(n.updated_at), "d MMM yyyy")}
                    </span>
                    <p className="mt-1 text-foreground">
                      <TextWithMentions text={n.body} />
                    </p>
                  </li>
                );
              })}
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

  return (
    <section className="rounded-lg border border-border bg-background p-6 space-y-5">
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
              className="h-full w-full rounded-full bg-muted/40 object-cover ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
            />
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 items-center rounded-full bg-amber-400 px-1 font-mono text-[8px] font-semibold leading-none tracking-tight text-white shadow-sm ring-1 ring-white"
            >
              AI
            </span>
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {champion.display_name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {profile?.title ?? "AI Champion"}
              {champion.user_id ? "" : "  ·  hasn't signed in yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
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

    </section>
  );
}
