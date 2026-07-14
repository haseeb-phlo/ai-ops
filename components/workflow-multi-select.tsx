"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Checkbox list of workflows for forms that link a record to several at
 * once. Selected ids submit as repeated `<input name={name}>` values, read
 * server-side with formData.getAll(name). Pattern follows the workflow
 * picker in the log-intervention dialog, minus the cadence column and the
 * at-least-one requirement (links here are optional).
 */
export function WorkflowMultiSelect({
  workflows,
  name = "workflow_ids",
  defaultSelected = [],
}: {
  workflows: { id: string; name: string }[];
  name?: string;
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelected),
  );
  const [search, setSearch] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = search.trim()
    ? workflows.filter((w) =>
        w.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : workflows;

  return (
    <div className="overflow-hidden rounded-md border border-input">
      {workflows.length > 6 && (
        <div className="border-b border-border bg-muted/40 px-3 py-1.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows"
            className="h-7 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
        </div>
      )}
      <div className="max-h-44 overflow-y-auto">
        {workflows.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">
            No workflows yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">
            No matches.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((w) => {
              const checked = selected.has(w.id);
              return (
                <li key={w.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                      checked ? "bg-muted/60" : "hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      name={name}
                      value={w.id}
                      checked={checked}
                      onChange={() => toggle(w.id)}
                      className="size-4 rounded border-input"
                    />
                    <span className="truncate">{w.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selected.size > 0 && (
        <div className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          {selected.size} selected
        </div>
      )}
    </div>
  );
}
