"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Switches which cohort the admin screens are showing, preserving the tab. */
export function CohortPicker({
  cohorts,
  selectedId,
}: {
  cohorts: { id: string; name: string; status: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Cohort</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("cohort", e.target.value);
          router.push(`/learn/admin?${next.toString()}`);
        }}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
      >
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.status})
          </option>
        ))}
      </select>
    </label>
  );
}
