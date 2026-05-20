import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatar } from "@/lib/profile";
import { loadTeamOptions } from "@/lib/teams";
import { formatCadence } from "@/lib/frequency";
import { Galaxy, type GalaxyData } from "./_components/galaxy";
import {
  ViewToggle,
  DEFAULT_VIEW,
  type ViewKey,
} from "./_components/view-toggle";
import { OrgView } from "./_components/org-view";
import { InviteButton } from "../admin/_components/invite-button";

export const dynamic = "force-dynamic";

const VALID_VIEWS = new Set<ViewKey>(["map", "directory"]);

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
  email: string | null;
  display_name: string | null;
  title: string | null;
  team: string | null;
};

type UserEmailRow = {
  user_id: string;
  email: string | null;
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
  frequency_cadence: string | null;
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
  }>;
}) {
  const sp = await searchParams;
  const rawView = Array.isArray(sp.view) ? sp.view[0] : sp.view;
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
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b bg-background px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                People
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Reporting structure top to bottom. Collapse any branch with
                the −/+ button.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSuper && <InviteButton teams={inviteTeams} />}
              <ViewToggle active={view} />
            </div>
          </div>
        </div>
        <div className="px-6 py-6">
          <OrgView />
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
      .select("email, display_name, title, team")
      .returns<PeopleRow[]>(),
    supabase
      .from("workflows")
      .select(
        "id, name, team, regulatory, frequency_per_week, frequency_cadence, criticality_score, owner_names",
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

  // Resolve auth emails for the profile user_ids loaded above. user_emails
  // requires an explicit user_id list; we already have every signed-in
  // user's profile row in `profilesRes`, so pass those ids in.
  const profileUserIds = (profilesRes.data ?? []).map((p) => p.user_id);
  const userEmailsRes =
    profileUserIds.length === 0
      ? { data: [] as Array<{ user_id: string; email: string | null }>, error: null }
      : await supabase.rpc("user_emails", { p_user_ids: profileUserIds });

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

  // user_id → canonical email (from auth.users, exposed via the user_emails
  // RPC). Drives the email-based fallback used when a profile's customised
  // display_name diverges from the seeded people.display_name.
  const emailByUserId = new Map<string, string>();
  const userEmailsData = (userEmailsRes.data ?? []) as UserEmailRow[];
  for (const row of userEmailsData) {
    if (row.email) emailByUserId.set(row.user_id, row.email.toLowerCase());
  }

  // people-table info keyed by lowercased display_name and lowercased email.
  // The People page is the source of truth for org structure, so when a
  // profile and a people row collide we prefer the people row's team and
  // title. Email match is the canonical key; display_name is a secondary
  // path for ghosted entries where we don't yet know the email.
  type PeopleInfo = { team: string | null; title: string | null };
  const peopleByName = new Map<string, PeopleInfo>();
  const peopleByEmail = new Map<string, PeopleInfo>();
  for (const p of peopleRes.data ?? []) {
    const info: PeopleInfo = {
      team: p.team ?? null,
      title: p.title ?? null,
    };
    const name = p.display_name?.trim();
    if (name) peopleByName.set(name.toLowerCase(), info);
    if (p.email) peopleByEmail.set(p.email.trim().toLowerCase(), info);
  }

  const profileNames = new Set<string>();
  const data: GalaxyData = {
    viewerId: user.id,
    teams: [],
    people: [],
    workflows: [],
    history: [],
  };

  // 1. People from profiles (real users), enriched with people-table data.
  //    Resolution order: display_name match → canonical email match →
  //    role_grant team. Email is the most reliable key because users can
  //    customise display_name on the profile page and drift from the seed.
  for (const p of profilesRes.data ?? []) {
    const userEmail = emailByUserId.get(p.user_id) ?? null;
    const fallbackFromEmail = userEmail
      ? userEmail
          .split("@")[0]
          .replace(/\./g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
    const displayName =
      (p.display_name?.trim() && p.display_name.trim().length > 0
        ? p.display_name.trim()
        : null) ??
      // Fall back to "First Last" derived from email so an unset profile
      // still renders as a proper named node in the galaxy.
      fallbackFromEmail;
    if (!displayName) continue;

    const peopleMatch =
      peopleByName.get(displayName.toLowerCase()) ??
      (userEmail ? peopleByEmail.get(userEmail) : undefined);

    data.people.push({
      id: `user:${p.user_id}`,
      name: displayName,
      title: peopleMatch?.title ?? p.title ?? null,
      avatarUrl: resolveAvatar(p.avatar_url, p.user_id),
      team: peopleMatch?.team ?? teamByUser.get(p.user_id) ?? null,
      kind: "user",
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
    data.people.push({
      id: `name:${key}`,
      name,
      title: p.title ?? null,
      avatarUrl: resolveAvatar(null, name),
      team: p.team ?? null,
      kind: "ghost",
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
      frequencyLabel: formatCadence(w.frequency_cadence, w.frequency_per_week),
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
      <div className="border-b bg-background px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              People
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Teams orbit Phlo, people orbit their team, workflows orbit
              their owners.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuper && <InviteButton teams={inviteTeams} />}
            <ViewToggle active="map" />
          </div>
        </div>
      </div>
      <Galaxy data={data} />
    </div>
  );
}
