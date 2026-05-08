import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { loadTeamOptions } from "@/lib/teams";
import { TeamFilter } from "./_components/team-filter";
import { NewWorkflowDialog } from "./_components/new-workflow-dialog";

type WorkflowRow = {
  id: string;
  name: string;
  team: string | null;
  frequency_per_week: number | null;
  regulatory: boolean;
  created_by: string | null;
  workflow_steps: { count: number }[];
};

type ProfileLite = { user_id: string; display_name: string | null };
type UserEmailRow = { user_id: string; email: string | null };

const ALL_TEAMS = "all";

export default async function WorkflowsPage(props: {
  searchParams: Promise<{ team?: string }>;
}) {
  const [user, params] = await Promise.all([
    getSessionUser(),
    props.searchParams,
  ]);

  const supabase = await createClient();

  // Default filter: super admins see every team, since they are
  // company-wide editors; everyone else lands on their own team (or
  // "all" if they don't have one set).
  const defaultTeam =
    user.role === "super_admin" || !user.team ? ALL_TEAMS : user.team;
  const activeTeam = params.team ?? defaultTeam;

  // 1. Workflows + step counts (one round trip via Supabase aggregation).
  let q = supabase
    .from("workflows")
    .select(
      "id, name, team, frequency_per_week, regulatory, created_by, workflow_steps(count)",
    )
    .is("deleted_at", null)
    .order("name");

  if (activeTeam !== ALL_TEAMS) {
    q = q.eq("team", activeTeam);
  }

  const { data: workflows, error } = await q.returns<WorkflowRow[]>();

  // 2. Build {workflow_id -> active intervention count} via the join table.
  const workflowIds = (workflows ?? []).map((w) => w.id);
  const interventionCounts = new Map<string, number>();

  if (workflowIds.length > 0) {
    const { data: joinRows } = await supabase
      .from("intervention_workflows")
      .select("workflow_id, ai_interventions!inner(status)")
      .in("workflow_id", workflowIds)
      .eq("ai_interventions.status", "active");

    for (const r of joinRows ?? []) {
      interventionCounts.set(
        r.workflow_id,
        (interventionCounts.get(r.workflow_id) ?? 0) + 1,
      );
    }
  }

  // 3. Logged-by lookup. Resolve workflow.created_by to a display name via
  //    profiles, falling back to the auth.users email for users who haven't
  //    customised their profile yet. Empty for legacy rows where created_by
  //    is null (seed data).
  const creatorIds = Array.from(
    new Set(
      (workflows ?? [])
        .map((w) => w.created_by)
        .filter((v): v is string => !!v),
    ),
  );
  const creatorLabelById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const [{ data: profiles }, { data: emails }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds)
        .returns<ProfileLite[]>(),
      supabase.rpc("user_emails"),
    ]);
    for (const p of profiles ?? []) {
      const dn = p.display_name?.trim();
      if (dn) creatorLabelById.set(p.user_id, dn);
    }
    const emailRows = (emails ?? []) as UserEmailRow[];
    for (const e of emailRows) {
      if (creatorLabelById.has(e.user_id)) continue;
      if (e.email) creatorLabelById.set(e.user_id, e.email);
    }
  }

  // 4. Team options for the filter dropdown and the new-workflow picker.
  //    Unions people.team + workflows.team so every team a person belongs to
  //    is selectable, even if nobody has logged a workflow on it yet.
  const teamOptions = await loadTeamOptions(supabase, user.team);

  // 4. Directory snapshot for the New Workflow people picker. Sourcing from
  //    public.people keeps owners canonical (vs free-text "Alice K") so the
  //    galaxy / champion lookups can resolve them later.
  const { data: directoryPeople } = await supabase
    .from("people")
    .select("email, display_name, title, team")
    .order("display_name", { ascending: true })
    .returns<
      {
        email: string;
        display_name: string;
        title: string | null;
        team: string | null;
      }[]
    >();
  const pickerPeople = (directoryPeople ?? []).map((p) => ({
    email: p.email,
    displayName: p.display_name,
    title: p.title,
    team: p.team,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Workflows"
        description="Active recurring processes across the company."
        actions={
          <>
            <TeamFilter
              teams={teamOptions}
              value={activeTeam}
              userTeam={user.team}
            />
            <NewWorkflowDialog
              teams={teamOptions}
              defaultTeam={user.team ?? teamOptions[0] ?? ""}
              people={pickerPeople}
            />
          </>
        }
      />

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load workflows: {error.message}
        </p>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white">
        {(workflows ?? []).length === 0 && !error ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No workflows
            {activeTeam !== ALL_TEAMS && ` for team "${activeTeam}"`} yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Frequency / wk</TableHead>
                <TableHead className="text-right">Steps</TableHead>
                <TableHead>Regulatory</TableHead>
                <TableHead className="text-right">Active interventions</TableHead>
                <TableHead>Logged by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(workflows ?? []).map((wf) => {
                const stepsCount = wf.workflow_steps?.[0]?.count ?? 0;
                const activeInterventions = interventionCounts.get(wf.id) ?? 0;
                const loggedBy = wf.created_by
                  ? creatorLabelById.get(wf.created_by) ?? null
                  : null;

                return (
                  <TableRow key={wf.id}>
                    <TableCell className="font-medium text-zinc-900">
                      <Link
                        href={`/workflows/${wf.id}`}
                        className="hover:underline"
                      >
                        {wf.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-zinc-700">
                      {wf.team ?? <span className="text-zinc-400">-</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {wf.frequency_per_week ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stepsCount}
                    </TableCell>
                    <TableCell>
                      {wf.regulatory ? (
                        <Badge variant="destructive">Regulatory</Badge>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {activeInterventions}
                    </TableCell>
                    <TableCell className="text-zinc-700">
                      {loggedBy ?? <span className="text-zinc-400">-</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageContainer>
  );
}
