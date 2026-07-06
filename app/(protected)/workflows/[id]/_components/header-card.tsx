import { format } from "date-fns";
import { LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCadence } from "@/lib/frequency";
import { DeleteWorkflowButton } from "./delete-workflow-button";
import { EditWorkflowDialog } from "./edit-workflow-dialog";

export type WorkflowHeader = {
  id: string;
  name: string;
  team: string | null;
  regulatory: boolean;
  visibility: string;
  frequency_per_week: number | null;
  frequency_cadence: string | null;
  criticality_score: number | null;
  business_kpi: string | null;
  owner_names: string[];
  tools_used: string[] | null;
  notes: string | null;
};

const CRITICALITY_LABEL: Record<number, string> = {
  1: "Trivial",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Critical",
};

const CRITICALITY_CLASSNAME: Record<number, string> = {
  1: "bg-muted text-foreground border-border",
  2: "bg-muted text-foreground border-border",
  3: "bg-amber-50 text-amber-800 border-amber-200",
  4: "bg-orange-50 text-orange-800 border-orange-200",
  5: "bg-red-50 text-red-800 border-red-200",
};

export async function HeaderCard({
  workflow,
  teams,
  canEdit,
  canDelete,
  loggedByLabel,
  createdAt,
  hoursPerWeek,
  toolSuggestions,
}: {
  workflow: WorkflowHeader;
  teams: string[];
  canEdit: boolean;
  canDelete: boolean;
  loggedByLabel: string | null;
  createdAt: string;
  hoursPerWeek: number | null;
  toolSuggestions: string[];
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {workflow.name}
            </h1>
            {workflow.regulatory && (
              <Badge className="border-purple-200 bg-purple-50 text-purple-800">
                Regulatory
              </Badge>
            )}
            {workflow.visibility === "team" && (
              <Badge
                className="border-slate-200 bg-slate-50 text-slate-700"
                title="Only visible to the owner team and admins"
              >
                <LockIcon className="size-3" aria-hidden />
                Confidential
              </Badge>
            )}
            {workflow.criticality_score != null && (
              <Badge
                className={CRITICALITY_CLASSNAME[workflow.criticality_score]}
              >
                {CRITICALITY_LABEL[workflow.criticality_score] ?? "-"}
              </Badge>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Team
              </dt>
              <dd className="text-foreground">
                {workflow.team ?? (
                  <span className="text-muted-foreground">-</span>
                )}
              </dd>
            </div>
            <Field
              label="Frequency"
              value={formatCadence(
                workflow.frequency_cadence,
                workflow.frequency_per_week,
              )}
            />
            <Field
              label="Hours / wk"
              value={hoursPerWeek != null ? formatNumber(hoursPerWeek) : null}
            />
            <Field label="Business KPI" value={workflow.business_kpi} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Owners
              </dt>
              <dd className="text-foreground">
                {workflow.owner_names.length === 0 ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {workflow.owner_names.map((n, i) => (
                      <span key={`${n}-${i}`} className="inline-flex">
                        <span className="font-medium text-foreground">{n}</span>
                        {i < workflow.owner_names.length - 1 && (
                          <span className="text-muted-foreground/60">,</span>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Logged by
              </dt>
              <dd className="text-foreground">
                {loggedByLabel ? (
                  <span className="font-medium text-foreground">{loggedByLabel}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </dd>
            </div>
            <Field
              label="Logged on"
              value={format(new Date(createdAt), "d MMM yyyy")}
            />
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tools used
              </dt>
              <dd className="mt-1">
                <ToolList tools={workflow.tools_used ?? []} />
              </dd>
            </div>
          </dl>

          {workflow.notes && workflow.notes.trim().length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {workflow.notes}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canEdit && (
            <EditWorkflowDialog
              workflow={workflow}
              teams={teams}
              hoursPerWeek={hoursPerWeek}
              toolSuggestions={toolSuggestions}
            />
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

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{value ?? <span className="text-muted-foreground">-</span>}</dd>
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
