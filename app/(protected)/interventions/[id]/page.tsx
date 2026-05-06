import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { findChampionForPerson } from "@/lib/champions";
import {
  PersonName,
  TextWithMentions,
} from "@/components/people/champion-mark";
import { ChampionNotesSection } from "@/app/(protected)/_components/champion-notes/notes-section";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/nav-link";
import { toTitle } from "@/lib/utils";
import { LogMetricSnapshotButton } from "./_components/log-metric-snapshot-button";
import { EditInterventionDialog } from "./_components/edit-intervention-dialog";
import { StatusButton } from "./_components/status-button";

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
  type: InterventionType | null;
  status: Status | null;
  description: string | null;
  owner: string | null;
  minutes_saved_per_week: number | null;
  attribution_confidence: Confidence | null;
  adoption_status: AdoptionStatus | null;
  satisfaction: number | null;
  created_by: string | null;
  created_at: string;
};

type EditRow = {
  id: string;
  actor_email: string | null;
  action: "edit" | "status_change";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

type ChampionRow = { team: string };

type LinkedWorkflow = {
  workflows: { id: string; name: string; team: string | null } | null;
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

const STATUS_STYLES: Record<Status, string> = {
  active: "bg-green-50 text-green-800 ring-green-200",
  paused: "bg-amber-50 text-amber-800 ring-amber-200",
  retired: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default async function InterventionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: intervention },
    { data: links },
    { data: baselines },
    { data: metrics },
    { data: edits },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select(
        "id, name, type, status, description, owner, minutes_saved_per_week, attribution_confidence, adoption_status, satisfaction, created_by, created_at",
      )
      .eq("id", id)
      .maybeSingle<Intervention>(),
    supabase
      .from("intervention_workflows")
      .select("workflows(id, name, team)")
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
      .select("id, actor_email, action, field, old_value, new_value, created_at")
      .eq("intervention_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<EditRow[]>(),
  ]);

  if (!intervention) {
    notFound();
  }

  let ownerDisplayName: string | null = null;
  if (intervention.created_by) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", intervention.created_by)
      .maybeSingle<{ display_name: string | null }>();
    ownerDisplayName = ownerProfile?.display_name?.trim() || null;
  }
  const ownerLabel = ownerDisplayName ?? intervention.owner;
  const ownerChampion = await findChampionForPerson({
    userId: intervention.created_by,
    displayName: ownerLabel,
  });

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

  const baselineById = new Map(
    (baselines ?? []).map((b) => [b.workflow_id, b]),
  );
  const metricRows = metrics ?? [];
  const editRows = edits ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <BackLink href="/interventions">All interventions</BackLink>

      {/* Full card */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {intervention.name}
              </h1>
              {intervention.type && (
                <Badge variant="secondary">
                  {toTitle(intervention.type)}
                </Badge>
              )}
              {intervention.status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[intervention.status]}`}
                >
                  {toTitle(intervention.status)}
                </span>
              )}
            </div>

            {intervention.description && (
              <p className="text-sm text-zinc-600">
                <TextWithMentions text={intervention.description} />
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Owner
                </dt>
                <dd className="text-zinc-900">
                  {ownerLabel ? (
                    <PersonName name={ownerLabel} champion={ownerChampion} />
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </dd>
              </div>
              <Field
                label="Estimated mins / week"
                value={
                  intervention.minutes_saved_per_week != null
                    ? intervention.minutes_saved_per_week.toLocaleString()
                    : null
                }
              />
              <Field
                label="Created"
                value={format(new Date(intervention.created_at), "d MMM yyyy")}
              />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Adoption
                </dt>
                <dd>
                  <AdoptionChip status={intervention.adoption_status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Satisfaction
                </dt>
                <dd>
                  <SatisfactionChip score={intervention.satisfaction} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <EditInterventionDialog
                  intervention={{
                    id: intervention.id,
                    name: intervention.name,
                    type: intervention.type,
                    description: intervention.description,
                    minutes_saved_per_week: intervention.minutes_saved_per_week,
                    attribution_confidence: intervention.attribution_confidence,
                    adoption_status: intervention.adoption_status,
                    satisfaction: intervention.satisfaction,
                  }}
                />
                <StatusButton
                  interventionId={intervention.id}
                  status={intervention.status ?? "active"}
                />
              </>
            )}
            <LogMetricSnapshotButton interventionId={intervention.id} />
          </div>
        </div>
      </section>

      {/* Champion notes from each affected team's AI Champion. Endorsement
          is implicit in the act of writing a positive note - no separate
          "co-sign" affordance, which only added friction. */}
      <ChampionNotesSection
        targetType="intervention"
        targetId={intervention.id}
        relevantTeams={Array.from(
          new Set(
            (links ?? [])
              .map((l) => l.workflows?.team)
              .filter((t): t is string => !!t),
          ),
        )}
      />

      {/* Linked workflows */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Linked workflows
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {linkedWorkflows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No linked workflows.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
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
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {w.name}
                      </Link>
                      {w.team && (
                        <Link
                          href={`/champions/${encodeURIComponent(w.team)}`}
                          className="ml-2 text-xs text-zinc-500 hover:text-amber-700 hover:underline"
                          title={`AI Champion of ${w.team}`}
                        >
                          {w.team}
                        </Link>
                      )}
                    </div>
                    {b && (
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
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
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Metrics timeline
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {metricRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No snapshots yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {metricRows.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900 tabular-nums">
                      {format(new Date(m.snapshot_date), "d MMM yyyy")}
                    </span>
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                      <BaselineChip label="time" value={m.time_value} unit="min" />
                      <BaselineChip label="cost" value={m.cost_value} unit="£" />
                      <BaselineChip label="people" value={m.people_value} />
                      <BaselineChip label="errors" value={m.errors_value} />
                      <BaselineChip label="revenue" value={m.revenue_value} unit="£" />
                    </div>
                  </div>
                  {m.notes && (
                    <p className="mt-1 text-sm text-zinc-600">
                      <TextWithMentions text={m.notes} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Audit trail */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Edit history
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {editRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              No edits yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {editRows.map((e) => (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-zinc-900">
                      <span className="font-medium">
                        {e.actor_email ?? "Unknown"}
                      </span>{" "}
                      <span className="text-zinc-500">
                        {e.action === "status_change"
                          ? "changed status"
                          : `edited ${e.field?.replaceAll("_", " ")}`}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {format(new Date(e.created_at), "d MMM yyyy, HH:mm")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    <span className="text-zinc-400">from</span>{" "}
                    <span className="text-zinc-700">
                      {e.old_value ?? "-"}
                    </span>{" "}
                    <span className="text-zinc-400">to</span>{" "}
                    <span className="text-zinc-700">
                      {e.new_value ?? "-"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="text-zinc-900">
        {value ?? <span className="text-zinc-400">-</span>}
      </dd>
    </div>
  );
}

const ADOPTION_DOT: Record<AdoptionStatus, string> = {
  daily: "bg-emerald-500",
  weekly: "bg-emerald-400",
  occasional: "bg-amber-500",
  abandoned: "bg-red-500",
};

const ADOPTION_LABEL: Record<AdoptionStatus, string> = {
  daily: "Daily",
  weekly: "Weekly",
  occasional: "Occasional",
  abandoned: "Abandoned",
};

function AdoptionChip({ status }: { status: AdoptionStatus | null }) {
  if (!status) return <span className="text-zinc-400">-</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-900">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${ADOPTION_DOT[status]}`}
      />
      {ADOPTION_LABEL[status]}
    </span>
  );
}

function SatisfactionChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-400">-</span>;
  return (
    <span
      className="inline-flex items-baseline gap-0.5 text-zinc-900 tabular-nums"
      aria-label={`Satisfaction ${score} of 5`}
      title={`${score} of 5`}
    >
      <span className="font-medium">{score}</span>
      <span className="text-xs text-zinc-400">/ 5</span>
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
        <span className="text-zinc-400">{label}</span>{" "}
        <span className="text-zinc-300">-</span>
      </span>
    );
  }
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const text = unit === "£" ? `£${formatted}` : unit ? `${formatted} ${unit}` : formatted;
  return (
    <span className="tabular-nums">
      <span className="text-zinc-400">{label}</span>{" "}
      <span className="text-zinc-700">{text}</span>
    </span>
  );
}
