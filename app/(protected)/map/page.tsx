import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatar } from "@/lib/profile";
import { championsByDisplayName, loadChampions } from "@/lib/champions";
import { loadTeamOptions } from "@/lib/teams";
import { Galaxy, type GalaxyData } from "./_components/galaxy";
import {
  ViewToggle,
  DEFAULT_VIEW,
  type ViewKey,
} from "./_components/view-toggle";
import { DirectoryView } from "./_components/directory-view";
import { ChampionsView } from "./_components/champions-view";
import { OrgView } from "./_components/org-view";
import {
  DirectoryModeToggle,
  DEFAULT_MODE,
  type DirectoryMode,
} from "./_components/directory-mode-toggle";
import { InviteButton } from "../admin/_components/invite-button";

export const dynamic = "force-dynamic";

const VALID_VIEWS = new Set<ViewKey>(["map", "directory", "champions"]);
const VALID_MODES = new Set<DirectoryMode>(["tree", "list"]);

function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
};

type PeopleRow = {
  display_name: string | null;
  title: string | null;
  team: string | null;
};

type RoleGrantRow = {
  user_id: string;
  team: string | null;
};

type WorkflowRow = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  frequency_per_week: number | null;
  criticality_score: number | null;
  owner_names: string[] | null;
};

type InterventionJoinRow = {
  workflow_id: string;
  ai_interventions: { status: string | null } | null;
};

type HistoryRow = {
  workflow_id: string;
  snapshot_date: string;
  metric: string;
  value: number;
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    team?: string | string[];
    q?: string | string[];
    mode?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const rawView = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const rawTeam = Array.isArray(sp.team) ? sp.team[0] : sp.team;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const rawMode = Array.isArray(sp.mode) ? sp.mode[0] : sp.mode;
  const directoryMode: DirectoryMode =
    typeof rawMode === "string" && VALID_MODES.has(rawMode as DirectoryMode)
      ? (rawMode as DirectoryMode)
      : DEFAULT_MODE;
  const requestedView =
    typeof rawView === "string" && rawView.length > 0
      ? rawView.toLowerCase()
      : DEFAULT_VIEW;
  const view: ViewKey = VALID_VIEWS.has(requestedView as ViewKey)
    ? (requestedView as ViewKey)
    : DEFAULT_VIEW;

  const user = await getSessionUser();
  // Effective role honours impersonation: a super-admin viewing as a member
  // sees Member affordances and loses the Invite button.
  const isSuper = user.role === "super_admin";
  const inviteTeams = isSuper
    ? await loadTeamOptions(await createClient())
    : [];

  if (view === "directory") {
    const isTree = directoryMode === "tree";
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b bg-white px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                People
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isTree
                  ? "Reporting structure top to bottom. AI Champions glow amber; collapse any branch with the −/+ button."
                  : "Search and browse everyone in the directory. Dimmed rows haven't signed in yet."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSuper && <InviteButton teams={inviteTeams} />}
              <ViewToggle active={view} />
            </div>
          </div>
          <div className="mt-4">
            <DirectoryModeToggle active={directoryMode} />
          </div>
        </div>
        <div className="px-6 py-6">
          {isTree ? (
            <OrgView />
          ) : (
            <DirectoryView team={rawTeam ?? null} q={rawQ ?? null} />
          )}
        </div>
      </div>
    );
  }

  if (view === "champions") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b bg-white px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                People
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AI Champions - one per team, the editorial voice for AI work.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSuper && <InviteButton teams={inviteTeams} />}
              <ViewToggle active={view} />
            </div>
          </div>
        </div>
        <div className="px-6 py-6">
          <ChampionsView />
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [
    profilesRes,
    grantsRes,
    peopleRes,
    workflowsRes,
    interventionsRes,
    historyRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, title")
      .returns<ProfileRow[]>(),
    supabase
      .from("role_grants")
      .select("user_id, team")
      .returns<RoleGrantRow[]>(),
    supabase
      .from("people")
      .select("display_name, title, team")
      .returns<PeopleRow[]>(),
    supabase
      .from("workflows")
      .select(
        "id, name, team, regulatory, frequency_per_week, criticality_score, owner_names",
      )
      .is("deleted_at", null)
      .returns<WorkflowRow[]>(),
    supabase
      .from("intervention_workflows")
      .select("workflow_id, ai_interventions!inner(status)")
      .eq("ai_interventions.status", "active")
      .returns<InterventionJoinRow[]>(),
    supabase
      .from("workflow_metrics_history")
      .select("workflow_id, snapshot_date, metric, value")
      .gte("snapshot_date", ninetyDaysAgo())
      .returns<HistoryRow[]>(),
  ]);

  const errors = [
    profilesRes.error,
    grantsRes.error,
    peopleRes.error,
    workflowsRes.error,
    interventionsRes.error,
    historyRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load map: {errors[0]?.message}
        </p>
        <p className="text-sm text-muted-foreground">
          This usually means the migration files haven&apos;t been applied yet.
          Run <code>supabase/profiles_and_history_migration.sql</code> and{" "}
          <code>supabase/seed.sql</code> in the Supabase SQL Editor.
        </p>
      </div>
    );
  }

  const teamByUser = new Map<string, string | null>();
  for (const g of grantsRes.data ?? []) {
    teamByUser.set(g.user_id, g.team ?? null);
  }

  // people-table info keyed by lowercased display_name. The People page is
  // the source of truth for org structure, so when a profile and a people
  // row collide on name we prefer the people row's team and title.
  const peopleByName = new Map<
    string,
    { team: string | null; title: string | null }
  >();
  for (const p of peopleRes.data ?? []) {
    const name = p.display_name?.trim();
    if (!name) continue;
    peopleByName.set(name.toLowerCase(), {
      team: p.team ?? null,
      title: p.title ?? null,
    });
  }

  const profileNames = new Set<string>();
  const data: GalaxyData = {
    viewerId: user.id,
    teams: [],
    people: [],
    workflows: [],
    history: [],
  };

  const championsByUser = await (async () => {
    const all = await loadChampions();
    const m = new Map<string, { team: string }>();
    for (const c of all) {
      // A user can be a champion of multiple teams; the galaxy node only
      // shows one, so we keep the first encountered (loadChampions orders
      // by team then created_at, so this is deterministic).
      if (c.user_id && !m.has(c.user_id)) m.set(c.user_id, { team: c.team });
    }
    return m;
  })();
  const championsByName = await championsByDisplayName();

  // 1. People from profiles (real users), enriched with people-table data
  //    when the names match.
  for (const p of profilesRes.data ?? []) {
    const displayName =
      p.display_name?.trim() && p.display_name.trim().length > 0
        ? p.display_name.trim()
        : null;
    if (!displayName) continue;
    const peopleMatch = peopleByName.get(displayName.toLowerCase());
    const champ =
      championsByUser.get(p.user_id) ??
      (championsByName.get(displayName.toLowerCase())
        ? { team: championsByName.get(displayName.toLowerCase())!.team }
        : null);
    data.people.push({
      id: `user:${p.user_id}`,
      name: displayName,
      title: peopleMatch?.title ?? p.title ?? null,
      avatarUrl: resolveAvatar(p.avatar_url, p.user_id),
      team: peopleMatch?.team ?? teamByUser.get(p.user_id) ?? null,
      kind: "user",
      isChampion: !!champ,
      championTeam: champ?.team ?? null,
    });
    profileNames.add(displayName.toLowerCase());
  }

  // 2. People-table rows that don't match a profile → ghost nodes with their
  //    proper team and title. Use `name:${key}` ids so workflow-owner edges
  //    naturally connect to them.
  for (const p of peopleRes.data ?? []) {
    const name = p.display_name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (profileNames.has(key)) continue;
    const champ = championsByName.get(key);
    data.people.push({
      id: `name:${key}`,
      name,
      title: p.title ?? null,
      avatarUrl: resolveAvatar(null, name),
      team: p.team ?? null,
      kind: "ghost",
      isChampion: !!champ,
      championTeam: champ?.team ?? null,
    });
    profileNames.add(key);
  }

  // 3. Workflow owners not yet covered by profiles or people → ghost nodes
  //    seeded purely from the owner_names string.
  const ghostByName = new Map<string, string>(); // lower-name -> id
  for (const w of workflowsRes.data ?? []) {
    for (const rawName of w.owner_names ?? []) {
      const name = rawName.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (profileNames.has(key) || ghostByName.has(key)) continue;
      const id = `name:${key}`;
      ghostByName.set(key, id);
      const champ = championsByName.get(key);
      data.people.push({
        id,
        name,
        title: null,
        avatarUrl: resolveAvatar(null, name),
        team: w.team,
        kind: "ghost",
        isChampion: !!champ,
        championTeam: champ?.team ?? null,
      });
    }
  }

  // 4. Teams = union of all known teams.
  const teams = new Set<string>();
  for (const w of workflowsRes.data ?? []) if (w.team) teams.add(w.team);
  for (const g of grantsRes.data ?? []) if (g.team) teams.add(g.team);
  for (const p of peopleRes.data ?? []) if (p.team) teams.add(p.team);
  data.teams = Array.from(teams).sort().map((name) => ({ id: `team:${name}`, name }));

  // 4. Active intervention counts per workflow
  const interventionsByWorkflow = new Map<string, number>();
  for (const r of interventionsRes.data ?? []) {
    interventionsByWorkflow.set(
      r.workflow_id,
      (interventionsByWorkflow.get(r.workflow_id) ?? 0) + 1,
    );
  }

  // 5. Workflows + owner edges
  for (const w of workflowsRes.data ?? []) {
    const ownerIds = (w.owner_names ?? [])
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const key = n.toLowerCase();
        const profileMatch = (profilesRes.data ?? []).find(
          (p) => p.display_name?.trim().toLowerCase() === key,
        );
        return profileMatch ? `user:${profileMatch.user_id}` : `name:${key}`;
      });

    data.workflows.push({
      id: `wf:${w.id}`,
      rawId: w.id,
      name: w.name,
      team: w.team,
      regulatory: w.regulatory,
      frequencyPerWeek: w.frequency_per_week ?? 0,
      criticality: w.criticality_score ?? 3,
      activeInterventions: interventionsByWorkflow.get(w.id) ?? 0,
      ownerIds,
    });
  }

  // 6. History rows - pass straight through, the client groups them
  for (const h of historyRes.data ?? []) {
    data.history.push({
      workflowId: `wf:${h.workflow_id}`,
      date: h.snapshot_date,
      metric: h.metric,
      value: h.value,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b bg-white px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              People
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Teams orbit Phlo, people orbit their team, workflows orbit their
              owners.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuper && <InviteButton teams={inviteTeams} />}
            <ViewToggle active="map" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
            <span
              aria-hidden
              className="relative inline-flex size-4 items-center justify-center"
            >
              <span className="size-3 rounded-full ring-2 ring-amber-500 bg-zinc-50" />
              <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold leading-none text-white">
                ⚡
              </span>
            </span>
            <span>
              <strong>AI Champion</strong> — amber ring + lightning. Click to
              open their page.
            </span>
          </span>
        </div>
      </div>
      <Galaxy data={data} />
    </div>
  );
}
