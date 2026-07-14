import { LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Time } from "@/components/ui/time";
import { cn } from "@/lib/utils";
import type { PickerPerson } from "@/components/ui/people-picker";
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

const CRITICALITY_TONE: Record<number, string> = {
  1: "bg-muted-foreground/50",
  2: "bg-muted-foreground/50",
  3: "bg-amber-500",
  4: "bg-orange-500",
  5: "bg-rose-500",
};

// Ascending tick heights, one per criticality step. Filled count + height
// double-encode the 1-5 score, so it survives colour-blindness.
const METER_HEIGHTS = ["h-1", "h-1.5", "h-2", "h-2.5", "h-3"] as const;

function CriticalityMeter({ score }: { score: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 bg-card"
      title={`Criticality ${score} of 5`}
    >
      <span aria-hidden className="flex items-end gap-[2px]">
        {METER_HEIGHTS.map((h, i) => (
          <span
            key={h}
            className={cn(
              "w-[3px] rounded-full",
              h,
              i < score ? CRITICALITY_TONE[score] : "bg-border",
            )}
          />
        ))}
      </span>
      {CRITICALITY_LABEL[score] ?? "-"}
    </Badge>
  );
}

export async function HeaderCard({
  workflow,
  teams,
  people,
  canEdit,
  canDelete,
  loggedByLabel,
  createdAt,
  hoursPerWeek,
  toolSuggestions,
}: {
  workflow: WorkflowHeader;
  teams: string[];
  people: PickerPerson[];
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
              // Rose dot echoes the galaxy map's pink regulatory ring.
              <Badge variant="outline" className="gap-1.5 bg-card">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-rose-500"
                />
                Regulatory
              </Badge>
            )}
            {workflow.visibility === "team" && (
              <Badge
                variant="secondary"
                title="Only visible to the owner team and admins"
              >
                <LockIcon className="size-3" aria-hidden />
                Confidential
              </Badge>
            )}
            {workflow.criticality_score != null && (
              <CriticalityMeter score={workflow.criticality_score} />
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
                  <span className="font-medium text-foreground">
                    {workflow.owner_names.join(", ")}
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
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Logged on
              </dt>
              <dd className="text-foreground">
                <Time iso={createdAt} />
              </dd>
            </div>
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
              people={people}
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
