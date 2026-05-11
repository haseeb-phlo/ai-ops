import { championsByDisplayName, championsByTeam } from "@/lib/champions";
import { PersonName } from "@/components/people/champion-mark";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DeleteWorkflowButton } from "./delete-workflow-button";
import { EditWorkflowDialog } from "./edit-workflow-dialog";

export type WorkflowHeader = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  frequency: string | null;
  criticality: "low" | "medium" | "high" | "critical" | null;
  business_kpi: string | null;
  owner_names: string[];
  tools_used: string[] | null;
};

const CRITICALITY_STYLES: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-orange-50 text-orange-800 ring-orange-200",
  critical: "bg-red-50 text-red-800 ring-red-200",
};

export async function HeaderCard({
  workflow,
  teams,
  canEdit,
  canDelete,
  loggedByLabel,
  createdAt,
}: {
  workflow: WorkflowHeader;
  teams: string[];
  canEdit: boolean;
  canDelete: boolean;
  loggedByLabel: string | null;
  createdAt: string;
}) {
  const champByName = await championsByDisplayName();
  const champByTeam = await championsByTeam();
  const teamChampion = workflow.team ? champByTeam.get(workflow.team) : null;
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
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Team
              </dt>
              <dd className="text-zinc-900">
                {workflow.team ? (
                  teamChampion ? (
                    <Link
                      href={`/champions/${encodeURIComponent(workflow.team)}`}
                      className="hover:underline"
                      title={`${teamChampion.display_name} - AI Champion of ${workflow.team}`}
                    >
                      {workflow.team}
                    </Link>
                  ) : (
                    workflow.team
                  )
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </dd>
            </div>
            <Field label="Frequency" value={workflow.frequency} />
            <Field label="Business KPI" value={workflow.business_kpi} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Owners
              </dt>
              <dd className="text-zinc-900">
                {workflow.owner_names.length === 0 ? (
                  <span className="text-zinc-400">-</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {workflow.owner_names.map((n, i) => {
                      const champ =
                        champByName.get(n.trim().toLowerCase()) ?? null;
                      return (
                        <span key={`${n}-${i}`} className="inline-flex">
                          <PersonName name={n} champion={champ} />
                          {i < workflow.owner_names.length - 1 && (
                            <span className="text-zinc-300">,</span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Logged by
              </dt>
              <dd className="text-zinc-900">
                {loggedByLabel ? (
                  <PersonName
                    name={loggedByLabel}
                    champion={
                      champByName.get(loggedByLabel.trim().toLowerCase()) ??
                      null
                    }
                  />
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </dd>
            </div>
            <Field
              label="Logged on"
              value={format(new Date(createdAt), "d MMM yyyy")}
            />
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Tools used
              </dt>
              <dd className="mt-1">
                <ToolList tools={workflow.tools_used ?? []} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canEdit && (
            <EditWorkflowDialog workflow={workflow} teams={teams} />
          )}
          {canDelete && (
            <DeleteWorkflowButton
              workflowId={workflow.id}
              workflowName={workflow.name}
            />
          )}
        </div>
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
      <dd className="text-zinc-900">{value ?? <span className="text-zinc-400">-</span>}</dd>
    </div>
  );
}

function ToolList({ tools }: { tools: string[] }) {
  if (tools.length === 0) {
    return <span className="text-zinc-400">-</span>;
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
