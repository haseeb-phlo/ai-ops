"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  addStep,
  deleteStep,
  moveStep,
  updateStepField,
  type StepField,
} from "../actions";

export type Step = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  owner: string | null;
  duration_minutes: number | null;
};

type EditingCell = { stepId: string; field: StepField } | null;

type Patch =
  | { kind: "edit"; stepId: string; field: StepField; value: string | number | null }
  | { kind: "delete"; stepId: string }
  | { kind: "move"; stepId: string; direction: "up" | "down" }
  | { kind: "add"; step: Step };

function reduce(state: Step[], patch: Patch): Step[] {
  switch (patch.kind) {
    case "edit":
      return state.map((s) =>
        s.id === patch.stepId ? { ...s, [patch.field]: patch.value } : s,
      );
    case "delete":
      return state
        .filter((s) => s.id !== patch.stepId)
        .map((s, i) => ({ ...s, position: i + 1 }));
    case "move": {
      const idx = state.findIndex((s) => s.id === patch.stepId);
      if (idx === -1) return state;
      const target = patch.direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= state.length) return state;
      const next = state.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, position: i + 1 }));
    }
    case "add":
      return [...state, patch.step];
  }
}

export function StepsTable({
  steps,
  workflowId,
  canEdit,
}: {
  steps: Step[];
  workflowId: string;
  canEdit: boolean;
}) {
  const [optimisticSteps, applyOptimistic] = useOptimistic<Step[], Patch>(
    steps,
    reduce,
  );

  const [editing, setEditing] = useState<EditingCell>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (
    stepId: string,
    field: StepField,
    rawValue: string,
    previousDisplay: string,
  ) => {
    setEditing(null);
    setError(null);

    const trimmed = rawValue.trim();
    if (trimmed === previousDisplay.trim()) return;

    const optimisticValue: string | number | null =
      field === "duration_minutes"
        ? trimmed === ""
          ? null
          : Number(trimmed)
        : trimmed === ""
          ? null
          : trimmed;

    startTransition(async () => {
      applyOptimistic({ kind: "edit", stepId, field, value: optimisticValue });
      const result = await updateStepField(stepId, field, rawValue);
      if (!result.ok) setError(result.error);
    });
  };

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      // Optimistic placeholder so the row appears immediately.
      const tempId = `tmp-${Date.now()}`;
      applyOptimistic({
        kind: "add",
        step: {
          id: tempId,
          position: optimisticSteps.length + 1,
          title: "New step",
          description: null,
          owner: null,
          duration_minutes: null,
        },
      });
      const result = await addStep(workflowId);
      if (!result.ok) setError(result.error);
      // Server revalidatePath will replace the optimistic row with the real one.
    });
  };

  const handleDelete = (stepId: string) => {
    setPendingDelete(null);
    setError(null);
    startTransition(async () => {
      applyOptimistic({ kind: "delete", stepId });
      const result = await deleteStep(stepId);
      if (!result.ok) setError(result.error);
    });
  };

  const handleMove = (stepId: string, direction: "up" | "down") => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ kind: "move", stepId, direction });
      const result = await moveStep(stepId, direction);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Steps
          </h2>
          {canEdit && (
            <p className="text-xs text-muted-foreground">
              Click any cell to edit. Use the arrows to reorder, the + button
              below to add a step.
            </p>
          )}
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={isPending}
          >
            <Plus className="size-3.5" />
            Add step
          </Button>
        )}
        {error && (
          <Alert variant="destructive" className="px-3 py-1 text-xs">
            {error}
          </Alert>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="w-40 px-3 py-2 text-left font-medium">Owner</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Duration</th>
              {canEdit && (
                <th className="w-28 px-3 py-2 text-right font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {optimisticSteps.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No steps yet.
                </td>
              </tr>
            )}
            {optimisticSteps.map((step, idx) => (
              <tr key={step.id} className="hover:bg-muted/50">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">
                  {step.position}
                </td>
                <Cell
                  step={step}
                  field="title"
                  display={step.title}
                  editing={editing}
                  setEditing={setEditing}
                  canEdit={canEdit}
                  save={save}
                />
                <Cell
                  step={step}
                  field="description"
                  display={step.description ?? ""}
                  editing={editing}
                  setEditing={setEditing}
                  canEdit={canEdit}
                  save={save}
                />
                <Cell
                  step={step}
                  field="owner"
                  display={step.owner ?? ""}
                  editing={editing}
                  setEditing={setEditing}
                  canEdit={canEdit}
                  save={save}
                />
                <Cell
                  step={step}
                  field="duration_minutes"
                  display={
                    step.duration_minutes == null
                      ? ""
                      : String(step.duration_minutes)
                  }
                  editing={editing}
                  setEditing={setEditing}
                  canEdit={canEdit}
                  save={save}
                  align="right"
                  inputType="number"
                  suffix="min"
                />
                {canEdit && (
                  <td className="px-3 py-1.5 text-right">
                    {pendingDelete === step.id ? (
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          onClick={() => handleDelete(step.id)}
                          disabled={isPending}
                        >
                          Delete
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => setPendingDelete(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-0.5">
                        <ActionButton
                          onClick={() => handleMove(step.id, "up")}
                          disabled={idx === 0 || isPending}
                          aria-label="Move up"
                        >
                          ↑
                        </ActionButton>
                        <ActionButton
                          onClick={() => handleMove(step.id, "down")}
                          disabled={
                            idx === optimisticSteps.length - 1 || isPending
                          }
                          aria-label="Move down"
                        >
                          ↓
                        </ActionButton>
                        <ActionButton
                          onClick={() => setPendingDelete(step.id)}
                          disabled={isPending}
                          aria-label="Delete step"
                          className="hover:text-destructive"
                        >
                          ✕
                        </ActionButton>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && optimisticSteps.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No steps logged yet. Click <strong>Add step</strong> above to start
          documenting how this workflow runs.
        </p>
      )}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Cell({
  step,
  field,
  display,
  editing,
  setEditing,
  canEdit,
  save,
  align = "left",
  inputType = "text",
  suffix,
}: {
  step: Step;
  field: StepField;
  display: string;
  editing: EditingCell;
  setEditing: (c: EditingCell) => void;
  canEdit: boolean;
  save: (
    stepId: string,
    field: StepField,
    rawValue: string,
    previousDisplay: string,
  ) => void;
  align?: "left" | "right";
  inputType?: "text" | "number";
  suffix?: string;
}) {
  const isEditing = editing?.stepId === step.id && editing?.field === field;
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (isEditing) {
    return (
      <td className={`px-3 py-1.5 ${alignClass}`}>
        <input
          autoFocus
          defaultValue={display}
          type={inputType}
          min={inputType === "number" ? 0 : undefined}
          onBlur={(e) => save(step.id, field, e.target.value, display)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(null);
            }
          }}
          className={`w-full rounded border border-ring px-2 py-1 text-sm outline-none ring-3 ring-ring/50 ${alignClass}`}
        />
      </td>
    );
  }

  const empty = display === "";
  const textClass = empty ? "text-muted-foreground" : "text-foreground";
  const content = (
    <>
      {empty ? "-" : display}
      {!empty && suffix ? (
        <span className="ml-1 text-muted-foreground">{suffix}</span>
      ) : null}
    </>
  );

  if (!canEdit) {
    return <td className={`px-3 py-2 ${alignClass} ${textClass}`}>{content}</td>;
  }

  // Click-to-edit must also work from the keyboard: the cell content is a
  // focusable button-like element - Enter or Space starts editing, with the
  // canonical focus-visible ring.
  const startEditing = () => setEditing({ stepId: step.id, field });

  return (
    <td className={`px-3 py-1.5 ${alignClass} ${textClass}`}>
      <div
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
        className={`w-full cursor-pointer rounded px-0 py-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${alignClass}`}
      >
        {content}
      </div>
    </td>
  );
}
