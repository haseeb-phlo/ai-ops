"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Step = {
  // Local-only React key. Not the DB row id - the server allocates step ids
  // on insert. We just need a stable key while the user reorders/edits.
  key: string;
  title: string;
  description: string;
};

const NUMBERING_PREFIX = /^\s*(?:\d+[.)]|[-*•])\s+/;

function newStep(): Step {
  return { key: crypto.randomUUID(), title: "", description: "" };
}

function stripPrefix(line: string): string {
  return line.replace(NUMBERING_PREFIX, "").trim();
}

/**
 * Auto-growing step list. Always renders one trailing empty placeholder so
 * adding a step is zero-click - just type. Multi-line paste into an empty
 * row splits into one step per non-empty line; "1.", "1)", "-", "*", "•"
 * leading markers are stripped so a numbered list pastes cleanly.
 *
 * Form serialization: hidden inputs `step_titles[]` + `step_descriptions[]`
 * in the same DOM order, zipped index-by-index server-side.
 */
export function StepEditor({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([newStep()]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const titleRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const descRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const committed = steps.filter((s) => s.title.trim() !== "");

  useEffect(() => {
    onCountChange?.(committed.length);
  }, [committed.length, onCountChange]);

  // Mutator that updates one step and ensures there's always a trailing
  // empty placeholder. Doing this in the setter (vs an effect) avoids a
  // double render on every keystroke.
  function updateStep(key: string, patch: Partial<Step>) {
    setSteps((prev) => {
      const next = prev.map((s) => (s.key === key ? { ...s, ...patch } : s));
      const last = next[next.length - 1];
      if (last.title.trim() !== "" || last.description.trim() !== "") {
        next.push(newStep());
      }
      return next;
    });
  }

  function removeStep(key: string) {
    setSteps((prev) => {
      const next = prev.filter((s) => s.key !== key);
      if (next.length === 0 || next[next.length - 1].title.trim() !== "") {
        next.push(newStep());
      }
      return next;
    });
  }

  function handlePaste(
    key: string,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) {
    const target = steps.find((s) => s.key === key);
    // Only intercept paste when the row is empty - typing inside a row that
    // already has a title shouldn't replace it with a multi-line paste.
    if (!target || target.title.trim() !== "") return;
    const text = e.clipboardData.getData("text");
    const lines = text
      .split(/\r?\n/)
      .map(stripPrefix)
      .filter((l) => l.length > 0);
    if (lines.length <= 1) return; // single line falls through to default paste
    e.preventDefault();
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx === -1) return prev;
      const filled: Step[] = lines.map((title, i) => ({
        key: i === 0 ? prev[idx].key : crypto.randomUUID(),
        title,
        description: "",
      }));
      const next = [...prev.slice(0, idx), ...filled, ...prev.slice(idx + 1)];
      if (next[next.length - 1].title.trim() !== "") {
        next.push(newStep());
      }
      return next;
    });
  }

  function handleTitleKey(
    key: string,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      descRefs.current.get(key)?.focus();
    }
  }

  function handleDescKey(
    key: string,
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    // Shift+Enter = literal newline (default). Plain Enter = jump to next
    // step's title, creating one if we're at the end.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const idx = steps.findIndex((s) => s.key === key);
      const nextStep = steps[idx + 1];
      if (nextStep) {
        titleRefs.current.get(nextStep.key)?.focus();
      }
    }
  }

  function onDragStart(key: string) {
    setDragKey(key);
  }

  function onDragOver(e: React.DragEvent, key: string) {
    if (dragKey === null || dragKey === key) return;
    const target = steps.find((s) => s.key === key);
    // Don't allow dropping onto the trailing placeholder - drag inserts
    // before the target, and the placeholder must stay last.
    if (
      target &&
      target.title.trim() === "" &&
      key === steps[steps.length - 1]?.key
    ) {
      return;
    }
    e.preventDefault();
    setDragOverKey(key);
  }

  function onDrop(targetKey: string) {
    if (dragKey === null || dragKey === targetKey) {
      setDragKey(null);
      setDragOverKey(null);
      return;
    }
    setSteps((prev) => {
      const fromIdx = prev.findIndex((s) => s.key === dragKey);
      const toIdx = prev.findIndex((s) => s.key === targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragKey(null);
    setDragOverKey(null);
  }

  function onDragEnd() {
    setDragKey(null);
    setDragOverKey(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Press Enter to jump to the description; press Enter again for the next
        step. Paste a numbered list to fill multiple steps at once.
      </p>

      <ul className="space-y-1.5">
        {steps.map((step, idx) => {
          const isPlaceholder =
            step.title.trim() === "" && idx === steps.length - 1;
          const number = idx + 1;
          return (
            <li
              key={step.key}
              draggable={!isPlaceholder}
              onDragStart={() => onDragStart(step.key)}
              onDragOver={(e) => onDragOver(e, step.key)}
              onDrop={() => onDrop(step.key)}
              onDragEnd={onDragEnd}
              className={cn(
                "group flex items-start gap-2 rounded-md border p-2 transition-colors",
                isPlaceholder
                  ? "border-dashed border-zinc-200 bg-zinc-50/40"
                  : "border-zinc-200 bg-white hover:border-zinc-300",
                dragKey === step.key && "opacity-40",
                dragOverKey === step.key && "border-zinc-900",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-2 select-none font-mono text-[10px] tabular-nums text-muted-foreground",
                  isPlaceholder && "opacity-30",
                )}
              >
                {number.toString().padStart(2, "0")}
              </span>

              <div className="flex-1 space-y-1">
                <input
                  ref={(el) => {
                    if (el) titleRefs.current.set(step.key, el);
                    else titleRefs.current.delete(step.key);
                  }}
                  value={step.title}
                  onChange={(e) =>
                    updateStep(step.key, { title: e.target.value })
                  }
                  onKeyDown={(e) => handleTitleKey(step.key, e)}
                  onPaste={(e) => handlePaste(step.key, e)}
                  placeholder={
                    isPlaceholder ? "Add the next step…" : "Step title"
                  }
                  maxLength={200}
                  className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                />
                {!isPlaceholder && (
                  <Textarea
                    ref={(el) => {
                      if (el) descRefs.current.set(step.key, el);
                      else descRefs.current.delete(step.key);
                    }}
                    value={step.description}
                    onChange={(e) =>
                      updateStep(step.key, { description: e.target.value })
                    }
                    onKeyDown={(e) => handleDescKey(step.key, e)}
                    placeholder="Optional description"
                    rows={1}
                    maxLength={2000}
                    className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-xs text-zinc-600 shadow-none focus-visible:ring-0 md:text-xs"
                  />
                )}
              </div>

              <div className="flex items-center gap-0.5 self-center">
                {!isPlaceholder && (
                  <button
                    type="button"
                    aria-label="Remove step"
                    onClick={() => removeStep(step.key)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-zinc-100 hover:text-foreground group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "rounded p-1 text-muted-foreground",
                    isPlaceholder
                      ? "opacity-0"
                      : "cursor-grab opacity-40 group-hover:opacity-100 active:cursor-grabbing",
                  )}
                >
                  <GripVertical className="size-3.5" />
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Hidden inputs: titles[] and descriptions[] in matching DOM order so
          formData.getAll() returns aligned arrays for server-side zipping. */}
      {committed.map((s) => (
        <input
          key={`t-${s.key}`}
          type="hidden"
          name="step_titles"
          value={s.title}
        />
      ))}
      {committed.map((s) => (
        <input
          key={`d-${s.key}`}
          type="hidden"
          name="step_descriptions"
          value={s.description}
        />
      ))}
    </div>
  );
}
