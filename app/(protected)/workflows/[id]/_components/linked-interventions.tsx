export type LinkedIntervention = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  proposed: "bg-muted text-foreground ring-border",
  in_progress: "bg-blue-50 text-blue-800 ring-blue-200",
  shipped: "bg-green-50 text-green-800 ring-green-200",
  blocked: "bg-red-50 text-red-800 ring-red-200",
};

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
              const statusClass =
                (iv.status && STATUS_STYLES[iv.status]) ??
                "bg-muted text-foreground ring-border";
              return (
                <li key={iv.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {iv.name}
                      </span>
                      {iv.status && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass}`}
                        >
                          {iv.status.replace("_", " ")}
                        </span>
                      )}
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
