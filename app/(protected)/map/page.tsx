import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatar } from "@/lib/profile";
import { Galaxy, type GalaxyData } from "./_components/galaxy";

export const dynamic = "force-dynamic";

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

export default async function MapPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    profilesRes,
    grantsRes,
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
      .from("workflows")
      .select(
        "id, name, team, regulatory, frequency_per_week, criticality_score, owner_names",
      )
      .eq("active", true)
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

  const profileNames = new Set<string>();
  const data: GalaxyData = {
    viewerId: user.id,
    teams: [],
    people: [],
    workflows: [],
    history: [],
  };

  // 1. People from profiles (real users)
  for (const p of profilesRes.data ?? []) {
    const displayName =
      p.display_name?.trim() && p.display_name.trim().length > 0
        ? p.display_name.trim()
        : null;
    if (!displayName) continue;
    data.people.push({
      id: `user:${p.user_id}`,
      name: displayName,
      title: p.title ?? null,
      avatarUrl: resolveAvatar(p.avatar_url, p.user_id),
      team: teamByUser.get(p.user_id) ?? null,
      kind: "user",
    });
    profileNames.add(displayName.toLowerCase());
  }

  // 2. Workflow owners not yet in profiles → ghost people seeded by name
  const ghostByName = new Map<string, string>(); // lower-name -> id
  for (const w of workflowsRes.data ?? []) {
    for (const rawName of w.owner_names ?? []) {
      const name = rawName.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (profileNames.has(key) || ghostByName.has(key)) continue;
      const id = `name:${key}`;
      ghostByName.set(key, id);
      data.people.push({
        id,
        name,
        title: null,
        avatarUrl: resolveAvatar(null, name),
        team: w.team,
        kind: "ghost",
      });
    }
  }

  // 3. Teams = union of all known teams
  const teams = new Set<string>();
  for (const w of workflowsRes.data ?? []) if (w.team) teams.add(w.team);
  for (const g of grantsRes.data ?? []) if (g.team) teams.add(g.team);
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

  // 6. History rows — pass straight through, the client groups them
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
      <div className="border-b bg-white px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Company map</h1>
        <p className="text-xs text-muted-foreground">
          Teams orbit Phlo. People orbit their team. Workflows orbit their
          owners. Bright workflows are critical; comet trails mean an active AI
          intervention.
        </p>
      </div>
      <Galaxy data={data} />
    </div>
  );
}
