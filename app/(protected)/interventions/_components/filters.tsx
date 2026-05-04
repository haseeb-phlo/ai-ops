"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function Filters({
  type,
  status,
  types,
  statuses,
}: {
  type: string | null;
  status: string | null;
  types: string[];
  statuses: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = (key: "type" | "status", value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value === "") next.delete(key);
    else next.set(key, value);

    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-zinc-600">Type</span>
        <select
          value={type ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          disabled={isPending}
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <span className="text-zinc-600">Status</span>
        <select
          value={status ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
          disabled={isPending}
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {(type || status) && (
        <button
          type="button"
          onClick={() => {
            startTransition(() => router.push(pathname));
          }}
          disabled={isPending}
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
