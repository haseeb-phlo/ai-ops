export type LinkedIntervention = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  proposed: "bg-zinc-100 text-zinc-700 ring-zinc-200",
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
      <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
        Linked AI initiatives
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {interventions.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No AI initiatives linked yet.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {interventions.map((iv) => {
              const statusClass =
                (iv.status && STATUS_STYLES[iv.status]) ??
                "bg-zinc-100 text-zinc-700 ring-zinc-200";
              return (
                <li key={iv.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">
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
                      <p className="mt-1 text-sm text-zinc-600">
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
