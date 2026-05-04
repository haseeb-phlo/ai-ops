import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { LogMetricSnapshotButton } from "./_components/log-metric-snapshot-button";

type InterventionType =
  | "tool"
  | "training"
  | "prompt"
  | "agent"
  | "automation"
  | "process_change";

type Status = "active" | "paused" | "retired";

type Intervention = {
  id: string;
  name: string;
  type: InterventionType | null;
  status: Status | null;
  description: string | null;
  owner: string | null;
  minutes_saved_per_week: number | null;
  created_at: string;
};

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
  await getSessionUser();
  const supabase = await createClient();

  const [
    { data: intervention },
    { data: links },
    { data: baselines },
    { data: metrics },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select(
        "id, name, type, status, description, owner, minutes_saved_per_week, created_at",
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
  ]);

  if (!intervention) {
    notFound();
  }

  const linkedWorkflows = (links ?? [])
    .map((row) => row.workflows)
    .filter((w): w is NonNullable<LinkedWorkflow["workflows"]> => w !== null);

  const baselineById = new Map(
    (baselines ?? []).map((b) => [b.workflow_id, b]),
  );
  const metricRows = metrics ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <nav className="text-sm">
        <Link
          href="/interventions"
          className="text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          ← All interventions
        </Link>
      </nav>

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
                  {intervention.type.replace("_", " ")}
                </Badge>
              )}
              {intervention.status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[intervention.status]}`}
                >
                  {intervention.status}
                </span>
              )}
            </div>

            {intervention.description && (
              <p className="text-sm text-zinc-600">{intervention.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <Field label="Owner" value={intervention.owner} />
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
            </dl>
          </div>

          <LogMetricSnapshotButton interventionId={intervention.id} />
        </div>
      </section>

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
                        <span className="ml-2 text-xs text-zinc-500">
                          {w.team}
                        </span>
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
                    <p className="mt-1 text-sm text-zinc-600">{m.notes}</p>
                  )}
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
        {value ?? <span className="text-zinc-400">—</span>}
      </dd>
    </div>
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
        <span className="text-zinc-300">—</span>
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
