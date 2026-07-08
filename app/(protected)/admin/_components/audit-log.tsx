"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Time } from "@/components/ui/time";

export type AuditRow = {
  id: string;
  when: string;
  who: string;
  kind: "workflow" | "step" | "initiative";
  target: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

const KIND_DOT: Record<AuditRow["kind"], string> = {
  workflow: "bg-muted-foreground",
  step: "bg-amber-500",
  initiative: "bg-blue-500",
};

// Column names that don't read well when naively title-cased.
const FIELD_OVERRIDES: Record<string, string> = {
  frequency_per_week: "Frequency (per week)",
  minutes_per_run: "Minutes (per run)",
  regulatory_flag: "Regulatory flag",
  created: "Created",
};

function humanizeField(field: string): string {
  const override = FIELD_OVERRIDES[field];
  if (override) return override;
  return field
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

const TRUNCATE_AT = 40;

function displayValue(v: string | null): string {
  return v == null || v === "" ? "(empty)" : v;
}

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.who,
        r.target,
        r.kind,
        r.field,
        humanizeField(r.field),
        r.oldValue ?? "",
        r.newValue ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Audit log
          </h2>
          <p className="text-xs text-muted-foreground">
            Last 100 edits across workflows, steps, and initiative status
            changes.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by person, workflow, or field"
            aria-label="Filter audit log"
            className="h-7 text-xs"
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-xs text-muted-foreground"
              >
                {rows.length === 0
                  ? "No changes recorded."
                  : "No entries match the filter."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((r) => {
              // Creation rows have no previous value by definition; show a
              // dash rather than pretending an "(empty)" value was edited.
              const isCreation = r.field === "created";
              const oldText = isCreation ? "—" : displayValue(r.oldValue);
              const newText = displayValue(r.newValue);
              const isLong =
                oldText.length > TRUNCATE_AT || newText.length > TRUNCATE_AT;
              const isExpanded = expanded.has(r.id);
              const shown = (v: string) =>
                !isExpanded && v.length > TRUNCATE_AT
                  ? v.slice(0, TRUNCATE_AT) + "…"
                  : v;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    <Time iso={r.when} relative />
                  </TableCell>
                  <TableCell className="text-xs text-foreground">{r.who}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full ${KIND_DOT[r.kind]}`}
                      />
                      {r.kind}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    {r.target}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {humanizeField(r.field)}
                  </TableCell>
                  <TableCell
                    className={
                      isExpanded
                        ? "max-w-md whitespace-normal text-xs text-muted-foreground"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    <span className="break-words text-muted-foreground" title={oldText}>
                      {shown(oldText)}
                    </span>
                    <span className="px-1 text-muted-foreground/60">→</span>
                    <span className="break-words text-foreground" title={newText}>
                      {shown(newText)}
                    </span>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(r.id)}
                        aria-expanded={isExpanded}
                        className="ml-1.5 inline-flex items-center gap-0.5 rounded text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {isExpanded ? (
                          <>
                            Less
                            <ChevronUp aria-hidden className="size-3" />
                          </>
                        ) : (
                          <>
                            More
                            <ChevronDown aria-hidden className="size-3" />
                          </>
                        )}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
