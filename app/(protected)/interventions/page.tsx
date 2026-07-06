import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/profile";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Time } from "@/components/ui/time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { toTitle } from "@/lib/utils";
import { INTERVENTION_STATUS } from "@/lib/status";
import { loadToolSuggestions } from "@/lib/tools";
import { Filters } from "./_components/filters";
import { LogInterventionDialog } from "./_components/log-intervention-dialog";

const INTERVENTION_TYPES = [
  "tool",
  "training",
  "prompt",
  "agent",
  "automation",
  "process_change",
] as const;

const STATUSES = ["active", "paused", "retired"] as const;

type InterventionType = (typeof INTERVENTION_TYPES)[number];
type Status = (typeof STATUSES)[number];

type InterventionRow = {
  id: string;
  name: string;
  types: InterventionType[] | null;
  status: Status | null;
  owner: string | null;
  created_by: string | null;
  created_at: string;
  intervention_workflows: { workflows: { id: string; name: string } | null }[];
};

type WorkflowOption = {
  id: string;
  name: string;
  frequency_per_week: number | null;
  frequency_cadence: string | null;
};

type WorkflowMetricRow = {
  workflow_id: string;
  time_baseline: number | null;
  cost_baseline: number | null;
  revenue_baseline: number | null;
};

type ProfileLite = { user_id: string; display_name: string | null };
type UserEmailRow = { user_id: string; email: string | null };

export default async function InterventionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  await getSessionUser();
  const params = await searchParams;

  const typeFilter =
    params.type && (INTERVENTION_TYPES as readonly string[]).includes(params.type)
      ? (params.type as InterventionType)
      : null;
  const statusFilter =
    params.status && (STATUSES as readonly string[]).includes(params.status)
      ? (params.status as Status)
      : null;
  const hasFilters = Boolean(typeFilter || statusFilter);

  const supabase = await createClient();

  let interventionsQuery = supabase
    .from("ai_interventions")
    .select(
      "id, name, types, status, owner, created_by, created_at, intervention_workflows(workflows(id, name))",
    )
    .order("created_at", { ascending: false });

  if (typeFilter)
    interventionsQuery = interventionsQuery.contains("types", [typeFilter]);
  if (statusFilter) interventionsQuery = interventionsQuery.eq("status", statusFilter);

  const [
    { data: interventions, error: interventionsError },
    { data: workflows },
    { data: workflowMetrics },
    { data: profiles },
    { data: directoryPeople },
  ] = await Promise.all([
    interventionsQuery.returns<InterventionRow[]>(),
    supabase
      .from("workflows")
      .select("id, name, frequency_per_week, frequency_cadence")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<WorkflowOption[]>(),
    supabase
      .from("workflow_metrics")
      .select("workflow_id, time_baseline, cost_baseline, revenue_baseline")
      .returns<WorkflowMetricRow[]>(),
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .returns<ProfileLite[]>(),
    supabase
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
      >(),
  ]);

  const rows = interventions ?? [];

  // "3 of 12" needs the unfiltered total; only worth a second (head-only)
  // query when a filter is active.
  let totalCount: number | null = null;
  if (hasFilters && !interventionsError) {
    const { count } = await supabase
      .from("ai_interventions")
      .select("id", { count: "exact", head: true });
    totalCount = count;
  }

  const peopleByEmail = new Map<string, string>();
  for (const p of directoryPeople ?? []) {
    if (p.email && p.display_name) {
      peopleByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }

  // "Logged by" resolution mirrors the workflows list: profile display name
  // (unless it's still the email-local default) → people directory →
  // email, so the same person reads identically across both areas.
  const profileById = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    profileById.set(p.user_id, p.display_name);
  }
  const creatorIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)),
  );
  const creatorLabelById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: emails } = await supabase.rpc("user_emails", {
      p_user_ids: creatorIds,
    });
    const emailById = new Map<string, string | null>();
    for (const e of (emails ?? []) as UserEmailRow[]) {
      emailById.set(e.user_id, e.email);
    }
    for (const id of creatorIds) {
      const email = emailById.get(id) ?? null;
      const peopleName = email
        ? peopleByEmail.get(email.trim().toLowerCase()) ?? null
        : null;
      const label = resolveDisplayName(profileById.get(id), peopleName, email);
      if (label) creatorLabelById.set(id, label);
    }
  }

  const pickerPeople = (directoryPeople ?? []).map((p) => ({
    email: p.email,
    displayName: p.display_name,
    title: p.title,
    team: p.team,
  }));

  const toolSuggestions = await loadToolSuggestions(supabase);

  // Stitch workflow_metrics into the workflow options so the log dialog can
  // show "per run" baseline context and the live readout. time_baseline is
  // stored in minutes - convert to hours so the dialog can do the same
  // math the new-workflow form uses.
  const metricsByWorkflowId = new Map<string, WorkflowMetricRow>();
  for (const m of workflowMetrics ?? []) {
    metricsByWorkflowId.set(m.workflow_id, m);
  }
  const workflowsForLog = (workflows ?? []).map((w) => {
    const m = metricsByWorkflowId.get(w.id);
    return {
      id: w.id,
      name: w.name,
      frequency_per_week: w.frequency_per_week,
      frequency_cadence: w.frequency_cadence,
      hours_per_week: m?.time_baseline != null ? m.time_baseline / 60 : null,
      cost_per_week: m?.cost_baseline ?? null,
      revenue_per_week: m?.revenue_baseline ?? null,
    };
  });

  return (
    <PageContainer>
      <PageHeader
        title="Initiatives"
        description="Tools, prompts, training, automations, and process changes shipped against workflows."
        actions={
          <LogInterventionDialog
            workflows={workflowsForLog}
            people={pickerPeople}
            toolSuggestions={toolSuggestions}
          />
        }
      />

      <Filters
        type={typeFilter}
        status={statusFilter}
        types={[...INTERVENTION_TYPES]}
        statuses={[...STATUSES]}
      />

      {interventionsError ? (
        <Alert variant="destructive">
          Could not load initiatives: {interventionsError.message}
        </Alert>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" aria-hidden />}
          title={
            hasFilters
              ? "No initiatives match these filters"
              : "No initiatives logged yet"
          }
          description={
            hasFilters
              ? "Try removing a filter, or log a new initiative."
              : "Initiatives are the tools, prompts, training, and process changes you ship against workflows. Log the first one to start tracking impact."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                render={<Link href="/interventions" />}
              >
                Clear filters
              </Button>
            ) : (
              <LogInterventionDialog
                workflows={workflowsForLog}
                people={pickerPeople}
                toolSuggestions={toolSuggestions}
              />
            )
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {totalCount != null && totalCount !== rows.length
              ? `${rows.length} of ${totalCount} initiatives`
              : `${rows.length} ${rows.length === 1 ? "initiative" : "initiatives"}`}
          </p>
          <div className="rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Workflows
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
                {rows.map((row) => {
                  const linkedCount = row.intervention_workflows.filter(
                    (l) => l.workflows !== null,
                  ).length;
                  const ownerName =
                    (row.created_by && creatorLabelById.get(row.created_by)) ||
                    row.owner;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/interventions/${row.id}`}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.types && row.types.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.types.map((t) => (
                              <Badge key={t} variant="secondary">
                                {toTitle(t)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status ? (
                          <Badge
                            className={
                              INTERVENTION_STATUS[row.status].badgeClassName
                            }
                          >
                            {INTERVENTION_STATUS[row.status].label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-foreground sm:table-cell">
                        {linkedCount}
                      </TableCell>
                      <TableCell className="hidden text-foreground lg:table-cell">
                        {ownerName ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                        <Time iso={row.created_at} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
