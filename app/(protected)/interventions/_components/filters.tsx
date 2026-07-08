"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toTitle } from "@/lib/utils";

// Select values can't be empty strings, so "all" is the sentinel for
// "no filter" - it maps to deleting the URL param.
const ALL = "all";

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
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Type</span>
        <Select
          value={type ?? ALL}
          onValueChange={(v) =>
            updateParam("type", !v || v === ALL ? "" : v)
          }
        >
          <SelectTrigger
            className="w-[150px]"
            aria-label="Filter by type"
            disabled={isPending}
          >
            <SelectValue>
              {(v) => (!v || v === ALL ? "All types" : toTitle(v as string))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {toTitle(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Status</span>
        <Select
          value={status ?? ALL}
          onValueChange={(v) =>
            updateParam("status", !v || v === ALL ? "" : v)
          }
        >
          <SelectTrigger
            className="w-[150px]"
            aria-label="Filter by status"
            disabled={isPending}
          >
            <SelectValue>
              {(v) =>
                !v || v === ALL ? "All statuses" : toTitle(v as string)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {toTitle(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(type || status) && (
        <button
          type="button"
          onClick={() => {
            startTransition(() => router.push(pathname));
          }}
          disabled={isPending}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
