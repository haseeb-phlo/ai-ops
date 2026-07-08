import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";
import { formatCadence } from "@/lib/frequency";
import { LockIcon, WorkflowIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Time } from "@/components/ui/time";
import { loadTeamOptions } from "@/lib/teams";
import { loadToolSuggestions } from "@/lib/tools";
import { TeamFilter } from "./_components/team-filter";
import { NewWorkflowDialog } from "./_components/new-workflow-dialog";

type WorkflowRow = {
  id: string;
  name: string;
  team: string | null;
  visibility: string;
  frequency_per_week: number | null;
  frequency_cadence: string | null;
  created_by: string | null;
  created_at: string;
  workflow_steps: { count: number }[];
};

type WorkflowMetricRow = {
  workflow_id: string;
  time_baseline: number | null;
  time_current: number | null;
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
      "id, name, team, visibility, frequency_per_week, frequency_cadence, created_by, created_at, workflow_steps(count)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (activeTeam !== ALL_TEAMS) {
    q = q.eq("team", activeTeam);
  }

  const { data: workflows, error } = await q.returns<WorkflowRow[]>();

  // 2. Build {workflow_id -> active intervention count} via the join table.
  //    And fetch the baseline metrics in the same round trip pass so the
  //    table can show Total hours alongside Frequency without a second
  //    request per row.
  const workflowIds = (workflows ?? []).map((w) => w.id);
  const interventionCounts = new Map<string, number>();
  const hoursByWorkflow = new Map<string, number>();

  if (workflowIds.length > 0) {
    const [{ data: joinRows }, { data: metricRows }] = await Promise.all([
      supabase
        .from("intervention_workflows")
        .select("workflow_id, ai_interventions!inner(status)")
        .in("workflow_id", workflowIds)
        .eq("ai_interventions.status", "active"),
      supabase
        .from("workflow_metrics")
        .select("workflow_id, time_baseline, time_current")
        .in("workflow_id", workflowIds)
        .returns<WorkflowMetricRow[]>(),
    ]);

    for (const r of joinRows ?? []) {
      interventionCounts.set(
        r.workflow_id,
        (interventionCounts.get(r.workflow_id) ?? 0) + 1,
      );
    }

    // time_* is stored in minutes; the table shows hours. Prefer the
    // current reading over the baseline so post-snapshot improvements
    // show up here.
    for (const m of metricRows ?? []) {
      const minutes = m.time_current ?? m.time_baseline;
      if (minutes != null) {
        hoursByWorkflow.set(m.workflow_id, minutes / 60);
      }
    }
  }

  // 3. Load the directory once and use it for both the Logged-by lookup
  //    and the New Workflow people picker below. Keying by lowercased email
  //    sidesteps any case drift between the directory seed and auth.users.
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
  const peopleByEmail = new Map<string, string>();
  for (const row of directoryPeople ?? []) {
    if (row.email && row.display_name) {
      peopleByEmail.set(row.email.trim().toLowerCase(), row.display_name);
    }
  }
  const pickerPeople = (directoryPeople ?? []).map((p) => ({
    email: p.email,
    displayName: p.display_name,
    title: p.title,
    team: p.team,
  }));

  // 4. Logged-by lookup. Resolve workflow.created_by → display name via
  //    resolveDisplayName: prefer profiles.display_name unless it's still the
  //    email-local default, else the people directory's canonical name, else
  //    the raw email. Empty for legacy rows where created_by is null.
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
      supabase.rpc("user_emails", { p_user_ids: creatorIds }),
    ]);
    const profileById = new Map<string, string | null>();
    for (const p of profiles ?? []) {
      profileById.set(p.user_id, p.display_name);
    }
    const emailRows = (emails ?? []) as UserEmailRow[];
    const emailById = new Map<string, string | null>();
    for (const e of emailRows) emailById.set(e.user_id, e.email);

    for (const id of creatorIds) {
      const email = emailById.get(id) ?? null;
      const peopleName = email
        ? peopleByEmail.get(email.trim().toLowerCase()) ?? null
        : null;
      const label = resolveDisplayName(
        profileById.get(id),
        peopleName,
        email,
      );
      if (label) creatorLabelById.set(id, label);
    }
  }

  // 5. Team options for the filter dropdown and the new-workflow picker.
  //    Unions people.team + workflows.team so every team a person belongs to
  //    is selectable, even if nobody has logged a workflow on it yet.
  const teamOptions = await loadTeamOptions(supabase, user.team);

  const toolSuggestions = await loadToolSuggestions(supabase);

  const isEmpty = (workflows ?? []).length === 0 && !error;

  // Result count. When a team filter is active, also fetch the unfiltered
  // total so the line reads "3 of 12 workflows".
  const rowCount = (workflows ?? []).length;
  let totalCount: number | null = null;
  if (activeTeam !== ALL_TEAMS) {
    const { count } = await supabase
      .from("workflows")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
    totalCount = count;
  }

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
              toolSuggestions={toolSuggestions}
            />
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          Could not load workflows: {error.message}
        </Alert>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<WorkflowIcon className="size-5" aria-hidden />}
          title={
            activeTeam !== ALL_TEAMS
              ? `No workflows for team "${activeTeam}" yet`
              : "No workflows yet"
          }
          description="Workflows are the recurring processes your team runs today — the ones AI initiatives chip away at. Log the first one to start measuring impact."
          action={
            <NewWorkflowDialog
              teams={teamOptions}
              defaultTeam={user.team ?? teamOptions[0] ?? ""}
              people={pickerPeople}
              toolSuggestions={toolSuggestions}
            />
          }
        />
      ) : (
        <>
        <p className="text-sm text-muted-foreground">
          {totalCount != null && totalCount !== rowCount
            ? `${rowCount} of ${totalCount} workflows`
            : `${rowCount} ${rowCount === 1 ? "workflow" : "workflows"}`}
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background">
                    Name
                  </TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead className="text-right">Hours / wk</TableHead>
                  <TableHead className="text-right">
                    <span className="hidden sm:inline">Active initiatives</span>
                    <span className="sm:hidden">Initiatives</span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Logged by
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Logged on
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(workflows ?? []).map((wf) => {
                  const stepsCount = wf.workflow_steps?.[0]?.count ?? 0;
                  const activeInterventions =
                    interventionCounts.get(wf.id) ?? 0;
                  const totalHours = hoursByWorkflow.get(wf.id) ?? null;
                  const loggedBy = wf.created_by
                    ? creatorLabelById.get(wf.created_by) ?? null
                    : null;

                  return (
                    <TableRow key={wf.id} className="group">
                      {/* Sticky cell needs an opaque background so rows
                          scrolling beneath don't show through - the ::before
                          overlay (below the content, above the background)
                          replays the row's hover tint so the frozen column
                          highlights with the rest of the row. */}
                      <TableCell className="sticky left-0 z-10 bg-background font-medium text-foreground before:absolute before:inset-0 before:-z-10 before:bg-muted/50 before:opacity-0 before:transition-opacity group-hover:before:opacity-100">
                        <Link
                          href={`/workflows/${wf.id}`}
                          className="hover:underline"
                        >
                          {wf.name}
                        </Link>
                        {wf.visibility === "team" && (
                          <LockIcon
                            className="ml-1.5 inline size-3.5 align-[-2px] text-muted-foreground"
                            aria-label="Confidential - only visible to the owner team and admins"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {wf.team ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatCadence(
                          wf.frequency_cadence,
                          wf.frequency_per_week,
                        ) ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stepsCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalHours != null ? (
                          totalHours.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {activeInterventions}
                      </TableCell>
                      <TableCell className="hidden text-foreground lg:table-cell">
                        {loggedBy ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-foreground tabular-nums md:table-cell">
                        <Time iso={wf.created_at} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        </>
      )}
    </PageContainer>
  );
}
