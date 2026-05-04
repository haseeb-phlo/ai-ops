import { formatDistanceToNow } from "date-fns";

export type ActivityRevision = {
  id: string;
  step_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  changed_at: string;
  step_title: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  owner: "Owner",
  duration_minutes: "Duration",
};

export function Activity({ revisions }: { revisions: ActivityRevision[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
        Activity
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {revisions.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No edits yet.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {revisions.map((rev) => (
              <li key={rev.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 text-zinc-600">
                  <span className="font-medium text-zinc-900">
                    {rev.changed_by_email ?? "Someone"}
                  </span>
                  <span>changed</span>
                  <span className="font-medium text-zinc-900">
                    {FIELD_LABELS[rev.field] ?? rev.field}
                  </span>
                  <span>on</span>
                  <span className="font-medium text-zinc-900">
                    {rev.step_title ?? "(deleted step)"}
                  </span>
                  <span className="text-zinc-400">·</span>
                  <time
                    className="text-zinc-500"
                    dateTime={rev.changed_at}
                    title={new Date(rev.changed_at).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(rev.changed_at), {
                      addSuffix: true,
                    })}
                  </time>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-800 ring-1 ring-inset ring-red-200 line-through">
                    {rev.old_value ?? "-"}
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-800 ring-1 ring-inset ring-green-200">
                    {rev.new_value ?? "-"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
