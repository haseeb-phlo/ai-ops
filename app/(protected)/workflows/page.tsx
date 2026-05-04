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
  workflow_steps: { count: number }[];
};

const ALL_TEAMS = "all";

export default async function WorkflowsPage(props: {
  searchParams: Promise<{ team?: string }>;
}) {
  const [user, params] = await Promise.all([
    getSessionUser(),
    props.searchParams,
  ]);

  const supabase = await createClient();

  // Default filter: user's own team (fall back to "all" if they have none).
  const activeTeam = params.team ?? (user.team ? user.team : ALL_TEAMS);

  // 1. Workflows + step counts (one round trip via Supabase aggregation).
  let q = supabase
    .from("workflows")
    .select(
      "id, name, team, frequency_per_week, regulatory, workflow_steps(count)",
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

  // 3. Team options for the filter dropdown and the new-workflow picker.
  //    Unions people.team + workflows.team so every team a person belongs to
  //    is selectable, even if nobody has logged a workflow on it yet.
  const teamOptions = await loadTeamOptions(supabase, user.team);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(workflows ?? []).map((wf) => {
                const stepsCount = wf.workflow_steps?.[0]?.count ?? 0;
                const activeInterventions = interventionCounts.get(wf.id) ?? 0;

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
