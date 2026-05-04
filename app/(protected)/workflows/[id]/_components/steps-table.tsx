"use client";

import { useOptimistic, useState, useTransition } from "react";
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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Steps
        </h2>
        {error && (
          <div
            role="alert"
            className="rounded-md bg-red-50 px-3 py-1 text-xs text-red-800 ring-1 ring-inset ring-red-200"
          >
            {error}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
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
          <tbody className="divide-y divide-zinc-100">
            {optimisticSteps.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-3 py-6 text-center text-zinc-400"
                >
                  No steps yet.
                </td>
              </tr>
            )}
            {optimisticSteps.map((step, idx) => (
              <tr key={step.id} className="hover:bg-zinc-50/50">
                <td className="px-3 py-2 text-zinc-500 tabular-nums">
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
                        <button
                          type="button"
                          onClick={() => handleDelete(step.id)}
                          disabled={isPending}
                          className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="rounded border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
                        >
                          Cancel
                        </button>
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
                          className="hover:text-red-700"
                        >
                          ✕
                        </ActionButton>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {canEdit && (
              <tr>
                <td colSpan={6} className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isPending}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                  >
                    + Add step
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent ${className}`}
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
          className={`w-full rounded border border-blue-400 px-2 py-1 text-sm outline-none ring-2 ring-blue-100 ${alignClass}`}
        />
      </td>
    );
  }

  const empty = display === "";
  const baseClass = `px-3 py-2 ${alignClass} ${
    empty ? "text-zinc-400" : "text-zinc-900"
  } ${canEdit ? "cursor-pointer" : ""}`;

  return (
    <td
      className={baseClass}
      onClick={
        canEdit ? () => setEditing({ stepId: step.id, field }) : undefined
      }
      title={canEdit ? "Click to edit" : undefined}
    >
      {empty ? "-" : display}
      {!empty && suffix ? <span className="ml-1 text-zinc-400">{suffix}</span> : null}
    </td>
  );
}
