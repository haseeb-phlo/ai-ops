"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
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

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-muted-foreground">
        No deleted workflows.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Deleted</TableHead>
            <TableHead>By</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-zinc-900">
                {row.name}
              </TableCell>
              <TableCell className="text-zinc-700">
                {row.team ?? <span className="text-zinc-400">-</span>}
              </TableCell>
              <TableCell className="text-zinc-500">
                {format(new Date(row.deleted_at), "d MMM yyyy, HH:mm")}
              </TableCell>
              <TableCell className="text-zinc-500">
                {row.deleted_by_email ?? (
                  <span className="text-zinc-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRestore(row.id)}
                    disabled={pendingId === row.id}
                  >
                    {pendingId === row.id ? "Restoring..." : "Restore"}
                  </Button>
                  {errors[row.id] && (
                    <span className="text-xs text-red-700">
                      {errors[row.id]}
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
