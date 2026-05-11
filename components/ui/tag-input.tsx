"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Free-text multi-select for short tags (e.g. tools used).
 *
 * Selected tags render as removable chips. The dropdown surfaces existing
 * suggestions filtered by the current query so the same name (e.g. "Claude")
 * converges across rows; the user can also commit a new tag with Enter or
 * comma. Hidden inputs emit one entry per selected tag so a Server Action
 * reads them via formData.getAll(inputName).
 */
export function TagInput({
  selected,
  onChange,
  suggestions = [],
  inputName,
  placeholder = "Type a name and press Enter",
  maxTags = 20,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  inputName?: string;
  placeholder?: string;
  maxTags?: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedSelected = useMemo(
    () => new Set(selected.map((t) => t.trim().toLowerCase())),
    [selected],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = suggestions
      .filter((s) => s.trim().length > 0)
      .filter((s) => !normalizedSelected.has(s.trim().toLowerCase()));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((s) => s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, query, normalizedSelected]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function add(rawTag: string) {
    const tag = rawTag.trim();
    if (!tag) return;
    if (selected.length >= maxTags) return;
    if (normalizedSelected.has(tag.toLowerCase())) return;
    onChange([...selected, tag]);
    setQuery("");
  }

  function remove(tag: string) {
    const lower = tag.trim().toLowerCase();
    onChange(selected.filter((t) => t.trim().toLowerCase() !== lower));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(query);
    } else if (
      e.key === "Backspace" &&
      query.length === 0 &&
      selected.length > 0
    ) {
      e.preventDefault();
      remove(selected[selected.length - 1]);
    }
  }

  const atMax = selected.length >= maxTags;

  return (
    <div ref={containerRef} className="space-y-2">
      {inputName &&
        selected.map((tag) => (
          <input key={tag} type="hidden" name={inputName} value={tag} />
        ))}

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => remove(tag)}
                className="group inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100"
                aria-label={`Remove ${tag}`}
              >
                <span className="truncate">{tag}</span>
                <span className="flex size-4 items-center justify-center rounded-full text-zinc-400 group-hover:text-zinc-700">
                  <X className="size-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={atMax ? `Up to ${maxTags} tools` : placeholder}
          disabled={atMax}
          aria-label="Add a tool"
        />

        {open && !atMax && (matches.length > 0 || query.trim().length > 0) && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <ul className="max-h-60 divide-y divide-border overflow-y-auto">
              {matches.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => add(s)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-zinc-900">
                      {s}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      Add
                    </span>
                  </button>
                </li>
              ))}
              {query.trim().length > 0 &&
                !normalizedSelected.has(query.trim().toLowerCase()) &&
                !matches.some(
                  (m) => m.toLowerCase() === query.trim().toLowerCase(),
                ) && (
                  <li>
                    <button
                      type="button"
                      onClick={() => add(query)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate text-zinc-900">
                        Add &ldquo;{query.trim()}&rdquo;
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        New
                      </span>
                    </button>
                  </li>
                )}
            </ul>
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span>
                {selected.length} / {maxTags}
              </span>
              <span>Enter or comma to add</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
