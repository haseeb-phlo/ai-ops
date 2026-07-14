import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/profile";
import { Badge } from "@/components/ui/badge";
import { Time } from "@/components/ui/time";
import { DetailHeader } from "@/components/ui/detail-header";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentRow } from "@/components/comments/comment-row";
import { toTitle } from "@/lib/utils";
import { formatCadence } from "@/lib/frequency";
import { INTERVENTION_STATUS } from "@/lib/status";
import { LogMetricSnapshotButton } from "./_components/log-metric-snapshot-button";
import { EditInterventionDialog } from "./_components/edit-intervention-dialog";
import { StatusButton } from "./_components/status-button";
import { DeleteInterventionButton } from "./_components/delete-intervention-button";
import { DismissableAlert } from "@/components/ui/dismissable-alert";
import {
  createInterventionComment,
  deleteInterventionComment,
} from "./actions";

type InterventionType =
  | "tool"
  | "training"
  | "prompt"
  | "agent"
  | "automation"
  | "process_change";

type Status = "active" | "paused" | "retired";
type Confidence = "high" | "medium" | "low";
type AdoptionStatus = "daily" | "weekly" | "occasional" | "abandoned";

type Intervention = {
  id: string;
  name: string;
  types: InterventionType[] | null;
  status: Status | null;
  description: string | null;
  owner: string | null;
  uses_per_week: number | null;
  frequency_cadence: string | null;
  minutes_saved_per_use: number | null;
  cost_saved_per_use: number | null;
  revenue_per_use: number | null;
  minutes_saved_per_week: number | null;
  estimated_gbp_saved_per_week: number | null;
  estimated_revenue_per_week: number | null;
  attribution_confidence: Confidence | null;
  adoption_status: AdoptionStatus | null;
  satisfaction: number | null;
  recipient_emails: string[] | null;
  tools_used: string[] | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type EditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: "edit" | "status_change";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

type ChampionRow = { team: string };

type LinkedWorkflow = {
  workflows: {
    id: string;
    name: string;
    team: string | null;
    frequency_per_week: number | null;
    frequency_cadence: string | null;
  } | null;
};

type WorkflowMetricRow = {
  workflow_id: string;
  time_baseline: number | null;
  cost_baseline: number | null;
  revenue_baseline: number | null;
};

type Baseline = {
  workflow_id: string;
  time_value: number | null;
  cost_value: number | null;
  people_value: number | null;
  errors_value: number | null;
  revenue_value: number | null;
  captured_at: string;
};

type MetricRow = {
  id: string;
  snapshot_date: string;
  time_value: number | null;
  cost_value: number | null;
  people_value: number | null;
  errors_value: number | null;
  revenue_value: number | null;
  notes: string | null;
};

type CommentRowData = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
};

export default async function InterventionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deleteFailed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const deleteFailed = sp.deleteFailed;
  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: intervention },
    { data: links },
    { data: baselines },
    { data: metrics },
    { data: edits },
    { data: addressedSuggestions },
    { data: comments },
    { data: directoryPeople },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select(
        "id, name, types, status, description, owner, uses_per_week, frequency_cadence, minutes_saved_per_use, cost_saved_per_use, revenue_per_use, minutes_saved_per_week, estimated_gbp_saved_per_week, estimated_revenue_per_week, attribution_confidence, adoption_status, satisfaction, recipient_emails, tools_used, notes, created_by, created_at",
      )
      .eq("id", id)
      .maybeSingle<Intervention>(),
    supabase
      .from("intervention_workflows")
      .select("workflows(id, name, team, frequency_per_week, frequency_cadence)")
      .eq("intervention_id", id)
      .returns<LinkedWorkflow[]>(),
    supabase
      .from("workflow_baselines")
      .select(
        "workflow_id, time_value, cost_value, people_value, errors_value, revenue_value, captured_at",
      )
      .eq("intervention_id", id)
      .returns<Baseline[]>(),
    supabase
      .from("intervention_metrics")
      .select(
        "id, snapshot_date, time_value, cost_value, people_value, errors_value, revenue_value, notes",
      )
      .eq("intervention_id", id)
      .order("snapshot_date", { ascending: false })
      .returns<MetricRow[]>(),
    supabase
      .from("intervention_edits")
      .select(
        "id, actor_id, actor_email, action, field, old_value, new_value, created_at",
      )
      .eq("intervention_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<EditRow[]>(),
    supabase
      .from("intervention_suggestions")
      .select("id, title, team, created_at, created_by")
      .eq("intervention_id", id)
      .order("created_at", { ascending: true })
      .returns<
        {
          id: string;
          title: string;
          team: string | null;
          created_at: string;
          created_by: string | null;
        }[]
      >(),
    supabase
      .from("ai_intervention_comments")
      .select("id, body, created_at, created_by")
      .eq("intervention_id", id)
      .order("created_at", { ascending: true })
      .returns<CommentRowData[]>(),
    // Company directory: powers the edit dialog's people picker and the
    // people-name leg of every display-name resolution on this page.
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

  if (!intervention) {
    notFound();
  }

  const pickerPeople = (directoryPeople ?? []).map((p) => ({
    email: p.email,
    displayName: p.display_name,
    title: p.title,
    team: p.team,
  }));
  const peopleByEmail = new Map<string, string>();
  for (const p of directoryPeople ?? []) {
    if (p.email && p.display_name) {
      peopleByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }

  const commentRows = comments ?? [];
  const editRows = edits ?? [];

  // Resolve every user referenced on this page (creator, commenters, edit
  // actors) through the same profile → people → email chain the rest of
  // the app uses, in one batched pass.
  const userIds = new Set<string>();
  if (intervention.created_by) userIds.add(intervention.created_by);
  for (const c of commentRows) {
    if (c.created_by) userIds.add(c.created_by);
  }
  for (const e of editRows) {
    if (e.actor_id) userIds.add(e.actor_id);
  }

  const profileById = new Map<string, string | null>();
  const emailById = new Map<string, string | null>();
  if (userIds.size > 0) {
    const ids = Array.from(userIds);
    const [{ data: profiles }, { data: emails }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids)
        .returns<{ user_id: string; display_name: string | null }[]>(),
      supabase.rpc("user_emails", { p_user_ids: ids }),
    ]);
    for (const p of profiles ?? []) {
      profileById.set(p.user_id, p.display_name);
    }
    for (const r of (emails ?? []) as {
      user_id: string;
      email: string | null;
    }[]) {
      emailById.set(r.user_id, r.email);
    }
  }

  function labelFor(
    userId: string | null,
    fallbackEmail: string | null = null,
  ): string | null {
    const email = (userId ? emailById.get(userId) : null) ?? fallbackEmail;
    const peopleName = email
      ? peopleByEmail.get(email.trim().toLowerCase()) ?? null
      : null;
    const resolved = resolveDisplayName(
      userId ? profileById.get(userId) : null,
      peopleName,
      email,
    );
    return resolved || null;
  }

  const ownerLabel = labelFor(intervention.created_by) ?? intervention.owner;

  // Mirror of public.can_edit_intervention(): super_admin / champion of
  // record (created_by) / a champion for any linked-workflow team.
  let canEdit = user.role === "super_admin" || intervention.created_by === user.id;
  if (!canEdit) {
    const teams = (links ?? [])
      .map((l) => l.workflows?.team)
      .filter((t): t is string => !!t);
    if (teams.length > 0) {
      const { data: championRows } = await supabase
        .from("champions")
        .select("team")
        .eq("user_id", user.id)
        .in("team", teams)
        .returns<ChampionRow[]>();
      canEdit = (championRows?.length ?? 0) > 0;
    }
  }

  const linkedWorkflows = (links ?? [])
    .map((row) => row.workflows)
    .filter((w): w is NonNullable<LinkedWorkflow["workflows"]> => w !== null);

  // Pull baseline per-week metrics for the linked workflows so the edit
  // dialog can show per-run context next to the per-use inputs.
  const linkedWorkflowIds = linkedWorkflows.map((w) => w.id);
  let workflowMetricsByWorkflowId = new Map<string, WorkflowMetricRow>();
  if (linkedWorkflowIds.length > 0) {
    const { data: workflowMetrics } = await supabase
      .from("workflow_metrics")
      .select("workflow_id, time_baseline, cost_baseline, revenue_baseline")
      .in("workflow_id", linkedWorkflowIds)
      .returns<WorkflowMetricRow[]>();
    workflowMetricsByWorkflowId = new Map(
      (workflowMetrics ?? []).map((m) => [m.workflow_id, m]),
    );
  }
  const linkedWorkflowsForEdit = linkedWorkflows.map((w) => {
    const m = workflowMetricsByWorkflowId.get(w.id);
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

  const baselineById = new Map(
    (baselines ?? []).map((b) => [b.workflow_id, b]),
  );
  const metricRows = metrics ?? [];

  const statusStyle = intervention.status
    ? INTERVENTION_STATUS[intervention.status]
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <DetailHeader
        backHref="/interventions"
        backLabel="All AI initiatives"
        title={intervention.name}
      />
      <div className="space-y-6">

      {deleteFailed && (
        <DismissableAlert
          param="deleteFailed"
          variant={deleteFailed === "permission" ? "warning" : "destructive"}
        >
          {deleteFailed === "permission"
            ? "Only super admins can delete an AI initiative."
            : "Couldn't delete this AI initiative — a database policy is missing. Contact an admin."}
        </DismissableAlert>
      )}

      {/* Full card */}
      <section className="rounded-lg border border-border bg-background p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {intervention.name}
              </h1>
              {statusStyle && (
                <Badge className={statusStyle.badgeClassName}>
                  {statusStyle.label}
                </Badge>
              )}
              {(intervention.types ?? []).map((t) => (
                <Badge key={t} variant="secondary">
                  {toTitle(t)}
                </Badge>
              ))}
            </div>

            {intervention.description && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {intervention.description}
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Logged by
                </dt>
                <dd className="text-foreground">
                  {ownerLabel ? (
                    <span className="font-medium text-foreground">{ownerLabel}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Logged on
                </dt>
                <dd className="text-foreground">
                  <Time iso={intervention.created_at} />
                </dd>
              </div>
              <Field
                label="Frequency"
                value={formatCadence(
                  intervention.frequency_cadence,
                  intervention.uses_per_week,
                )}
              />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Adoption
                </dt>
                <dd>
                  <AdoptionChip status={intervention.adoption_status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Satisfaction
                </dt>
                <dd>
                  <SatisfactionChip score={intervention.satisfaction} />
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tools used
                </dt>
                <dd className="mt-1">
                  <ToolList tools={intervention.tools_used ?? []} />
                </dd>
              </div>
            </dl>

            <ImpactBreakdown
              usesPerWeek={intervention.uses_per_week}
              minutesPerUse={intervention.minutes_saved_per_use}
              costPerUse={intervention.cost_saved_per_use}
              revenuePerUse={intervention.revenue_per_use}
            />

            {intervention.notes && intervention.notes.trim().length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </h2>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {intervention.notes}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <EditInterventionDialog
                  intervention={{
                    id: intervention.id,
                    name: intervention.name,
                    types: intervention.types ?? [],
                    status: intervention.status,
                    description: intervention.description,
                    uses_per_week: intervention.uses_per_week,
                    frequency_cadence: intervention.frequency_cadence,
                    minutes_saved_per_use: intervention.minutes_saved_per_use,
                    cost_saved_per_use: intervention.cost_saved_per_use,
                    revenue_per_use: intervention.revenue_per_use,
                    attribution_confidence: intervention.attribution_confidence,
                    adoption_status: intervention.adoption_status,
                    satisfaction: intervention.satisfaction,
                    recipient_emails: intervention.recipient_emails ?? [],
                    notes: intervention.notes,
                  }}
                  people={pickerPeople}
                  linkedWorkflows={linkedWorkflowsForEdit}
                />
                <StatusButton
                  interventionId={intervention.id}
                  status={intervention.status ?? "active"}
                />
                <LogMetricSnapshotButton interventionId={intervention.id} />
              </>
            )}
            {user.role === "super_admin" && (
              <DeleteInterventionButton
                interventionId={intervention.id}
                interventionName={intervention.name}
              />
            )}
          </div>
        </div>
      </section>

      {/* Suggestions this intervention closed out */}
      {(addressedSuggestions ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Addresses {addressedSuggestions!.length}{" "}
            {addressedSuggestions!.length === 1 ? "suggestion" : "suggestions"}
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-background">
            {addressedSuggestions!.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <Link
                  href={`/suggestions?tab=shipped`}
                  className="font-medium text-foreground hover:underline"
                >
                  {s.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.team && <>{s.team} · </>}
                  {format(new Date(s.created_at), "d MMM yyyy")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Linked workflows */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Linked workflows
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {linkedWorkflows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No linked workflows.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {linkedWorkflows.map((w) => {
                const b = baselineById.get(w.id);
                return (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/workflows/${w.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {w.name}
                      </Link>
                      {w.team && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {w.team}
                        </span>
                      )}
                    </div>
                    {b && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <BaselineChip label="time" value={b.time_value} unit="min" />
                        <BaselineChip label="cost" value={b.cost_value} unit="£" />
                        <BaselineChip label="people" value={b.people_value} />
                        <BaselineChip label="errors" value={b.errors_value} />
                        <BaselineChip label="revenue" value={b.revenue_value} unit="£" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Metrics timeline */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Metrics timeline
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {metricRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No snapshots yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {metricRows.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground tabular-nums">
                      {format(new Date(m.snapshot_date), "d MMM yyyy")}
                    </span>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <BaselineChip label="time" value={m.time_value} unit="min" />
                      <BaselineChip label="cost" value={m.cost_value} unit="£" />
                      <BaselineChip label="people" value={m.people_value} />
                      <BaselineChip label="errors" value={m.errors_value} />
                      <BaselineChip label="revenue" value={m.revenue_value} unit="£" />
                    </div>
                  </div>
                  {m.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {m.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Comments */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Comments
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {commentRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No comments yet. Start the discussion.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {commentRows.map((c) => (
                <CommentRow
                  key={c.id}
                  commentId={c.id}
                  body={c.body}
                  authorName={labelFor(c.created_by) ?? "Someone"}
                  createdAt={c.created_at}
                  canDelete={
                    user.realRole === "super_admin" ||
                    c.created_by === user.id
                  }
                  deleteAction={deleteInterventionComment}
                  hiddenFieldName="intervention_id"
                  hiddenFieldValue={intervention.id}
                />
              ))}
            </ul>
          )}
          <div className="border-t border-border px-4 py-3">
            <CommentForm
              action={createInterventionComment}
              hiddenFieldName="intervention_id"
              hiddenFieldValue={intervention.id}
            />
          </div>
        </div>
      </section>

      {/* Audit trail */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Edit history
        </h2>
        <div className="rounded-lg border border-border bg-background">
          {editRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No edits yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {editRows.map((e) => (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground">
                      <span className="font-medium">
                        {labelFor(e.actor_id, e.actor_email) ?? "Someone"}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {e.action === "status_change"
                          ? "changed status"
                          : `edited ${e.field?.replaceAll("_", " ")}`}
                      </span>
                    </span>
                    <Time
                      iso={e.created_at}
                      relative
                      className="text-xs text-muted-foreground tabular-nums"
                    />
                  </div>
                  <DiffChips oldValue={e.old_value} newValue={e.new_value} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

/**
 * Old → new value rendered as colored diff chips - same treatment as the
 * workflow Activity feed, so the two audit surfaces share one visual
 * grammar.
 */
function DiffChips({
  oldValue,
  newValue,
}: {
  oldValue: string | null;
  newValue: string | null;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800 ring-1 ring-inset ring-rose-200 line-through">
        {oldValue ?? "-"}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        →
      </span>
      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-inset ring-emerald-200">
        {newValue ?? "-"}
      </span>
    </div>
  );
}

function ImpactBreakdown({
  usesPerWeek,
  minutesPerUse,
  costPerUse,
  revenuePerUse,
}: {
  usesPerWeek: number | null;
  minutesPerUse: number | null;
  costPerUse: number | null;
  revenuePerUse: number | null;
}) {
  const uses = usesPerWeek ?? 0;
  if (
    usesPerWeek == null &&
    minutesPerUse == null &&
    costPerUse == null &&
    revenuePerUse == null
  ) {
    return null;
  }
  const fmt = (n: number | null) =>
    n == null
      ? "-"
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const weeklyMinutes = (minutesPerUse ?? 0) * uses;
  const weeklyCost = (costPerUse ?? 0) * uses;
  const weeklyRevenue = (revenuePerUse ?? 0) * uses;
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Impact per run × times per week
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        How the weekly total on the dashboard is computed for this initiative.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BreakdownLine
          perUse={`${fmt(minutesPerUse)} min`}
          uses={`${fmt(usesPerWeek)}`}
          weekly={`${fmt(weeklyMinutes)} min / wk`}
        />
        <BreakdownLine
          perUse={`£${fmt(costPerUse)}`}
          uses={`${fmt(usesPerWeek)}`}
          weekly={`£${fmt(weeklyCost)} / wk`}
          label="cost saved"
        />
        <BreakdownLine
          perUse={`£${fmt(revenuePerUse)}`}
          uses={`${fmt(usesPerWeek)}`}
          weekly={`£${fmt(weeklyRevenue)} / wk`}
          label="revenue"
        />
      </div>
    </div>
  );
}

function BreakdownLine({
  perUse,
  uses,
  weekly,
  label,
}: {
  perUse: string;
  uses: string;
  weekly: string;
  label?: string;
}) {
  return (
    <div className="space-y-0.5">
      {label && (
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        <span className="text-foreground">{perUse}</span>
        <span className="text-muted-foreground"> / run × </span>
        <span className="text-foreground">{uses}</span>
        <span className="text-muted-foreground"> runs / wk</span>
      </p>
      <p className="text-sm font-semibold tabular-nums text-foreground">
        = {weekly}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">
        {value ?? <span className="text-muted-foreground">-</span>}
      </dd>
    </div>
  );
}

function ToolList({ tools }: { tools: string[] }) {
  if (tools.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tools.map((t) => (
        <li key={t}>
          <Badge variant="outline" className="font-normal">
            {t}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

const ADOPTION_DOT: Record<AdoptionStatus, string> = {
  daily: "bg-emerald-500",
  weekly: "bg-emerald-400",
  occasional: "bg-amber-500",
  abandoned: "bg-rose-500",
};

const ADOPTION_LABEL: Record<AdoptionStatus, string> = {
  daily: "Daily",
  weekly: "Weekly",
  occasional: "Occasional",
  abandoned: "Abandoned",
};

function AdoptionChip({ status }: { status: AdoptionStatus | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${ADOPTION_DOT[status]}`}
      />
      {ADOPTION_LABEL[status]}
    </span>
  );
}

function SatisfactionChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className="inline-flex items-baseline gap-0.5 text-foreground tabular-nums"
      aria-label={`Satisfaction ${score} of 5`}
      title={`${score} of 5`}
    >
      <span className="font-medium">{score}</span>
      <span className="text-xs text-muted-foreground">/ 5</span>
    </span>
  );
}

function BaselineChip({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  if (value == null) {
    return (
      <span className="tabular-nums">
        <span className="text-muted-foreground">{label}</span>{" "}
        <span className="text-muted-foreground/60">-</span>
      </span>
    );
  }
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const text = unit === "£" ? `£${formatted}` : unit ? `${formatted} ${unit}` : formatted;
  return (
    <span className="tabular-nums">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="text-foreground">{text}</span>
    </span>
  );
}
