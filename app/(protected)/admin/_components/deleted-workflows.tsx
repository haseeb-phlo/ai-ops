"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Time } from "@/components/ui/time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { restoreWorkflow } from "@/app/(protected)/workflows/actions";

export type DeletedWorkflowRow = {
  id: string;
  name: string;
  team: string | null;
  deleted_at: string;
  deleted_by_email: string | null;
};

export function DeletedWorkflows({ rows }: { rows: DeletedWorkflowRow[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRestore(id: string) {
    // Clear the stale error for this row before starting a new attempt so
    // an old failure message never sits beside a fresh "Restoring…" state.
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPendingId(id);
    startTransition(async () => {
      const result = await restoreWorkflow(id);
      setPendingId(null);
      if (result.kind === "error") {
        setErrors((prev) => ({ ...prev, [id]: result.message }));
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Deleted workflows
        </h2>
        <p className="text-xs text-muted-foreground">
          Soft-deleted workflows. Restoring puts one back everywhere it
          appeared.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No deleted workflows.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">
                  {row.name}
                </TableCell>
                <TableCell className="text-xs">
                  {row.team ? (
                    <Badge variant="outline">{row.team}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Time iso={row.deleted_at} relative />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.deleted_by_email ?? (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      loading={pendingId === row.id}
                      onClick={() => handleRestore(row.id)}
                    >
                      {pendingId === row.id ? "Restoring…" : "Restore"}
                    </Button>
                    {errors[row.id] && (
                      <span role="alert" className="text-xs text-destructive">
                        {errors[row.id]}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
