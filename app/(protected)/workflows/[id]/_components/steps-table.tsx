"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateStepField, type StepField } from "../actions";

export type Step = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  owner: string | null;
  duration_minutes: number | null;
};

type EditingCell = { stepId: string; field: StepField } | null;

export function StepsTable({
  steps,
  canEdit,
}: {
  steps: Step[];
  canEdit: boolean;
}) {
  const [optimisticSteps, applyOptimistic] = useOptimistic<
    Step[],
    { stepId: string; field: StepField; value: string | number | null }
  >(steps, (state, patch) =>
    state.map((s) =>
      s.id === patch.stepId ? { ...s, [patch.field]: patch.value } : s,
    ),
  );

  const [editing, setEditing] = useState<EditingCell>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
      applyOptimistic({ stepId, field, value: optimisticValue });
      const result = await updateStepField(stepId, field, rawValue);
      if (!result.ok) {
        setError(result.error);
      }
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
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {optimisticSteps.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-zinc-400"
                >
                  No steps yet.
                </td>
              </tr>
            )}
            {optimisticSteps.map((step) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
      {empty ? "—" : display}
      {!empty && suffix ? <span className="ml-1 text-zinc-400">{suffix}</span> : null}
    </td>
  );
}
