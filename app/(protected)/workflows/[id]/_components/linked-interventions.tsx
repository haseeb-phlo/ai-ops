import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import {
  INTERVENTION_STATUS,
  type InterventionStatus,
} from "@/lib/status";

export type LinkedIntervention = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
};

function isInterventionStatus(v: string): v is InterventionStatus {
  return v in INTERVENTION_STATUS;
}

export function LinkedInterventions({
  interventions,
}: {
  interventions: LinkedIntervention[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        Linked AI initiatives
      </h2>
      <div className="rounded-lg border border-border bg-background">
        {interventions.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No AI initiatives linked yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {interventions.map((iv) => {
              const style =
                iv.status && isInterventionStatus(iv.status)
                  ? INTERVENTION_STATUS[iv.status]
                  : null;
              return (
                <li key={iv.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {iv.name}
                      </span>
                      {style ? (
                        <StatusPill status={style} />
                      ) : iv.status ? (
                        <Badge variant="secondary">
                          {iv.status.replace("_", " ")}
                        </Badge>
                      ) : null}
                    </div>
                    {iv.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {iv.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
