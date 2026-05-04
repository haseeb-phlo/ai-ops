import Link from "next/link";

export type WorkflowHeader = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  frequency: string | null;
  criticality: "low" | "medium" | "high" | "critical" | null;
  business_kpi: string | null;
  owner_names: string[];
};

const CRITICALITY_STYLES: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-orange-50 text-orange-800 ring-orange-200",
  critical: "bg-red-50 text-red-800 ring-red-200",
};

export function HeaderCard({
  workflow,
  canEdit,
}: {
  workflow: WorkflowHeader;
  canEdit: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {workflow.name}
            </h1>
            {workflow.regulatory && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800 ring-1 ring-inset ring-purple-200">
                Regulatory
              </span>
            )}
            {workflow.criticality && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  CRITICALITY_STYLES[workflow.criticality]
                }`}
              >
                {workflow.criticality}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="Team" value={workflow.team} />
            <Field label="Frequency" value={workflow.frequency} />
            <Field label="Business KPI" value={workflow.business_kpi} />
            <Field
              label="Owners"
              value={
                workflow.owner_names.length
                  ? workflow.owner_names.join(", ")
                  : null
              }
            />
          </dl>
        </div>

        {canEdit && (
          <Link
            href={`/workflows/${workflow.id}/edit`}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Edit
          </Link>
        )}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="text-zinc-900">{value ?? <span className="text-zinc-400">—</span>}</dd>
    </div>
  );
}
