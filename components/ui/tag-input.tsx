"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Free-text multi-select for short tags (e.g. tools used).
 *
 * Selected tags render as chips (with a dedicated remove button). The
 * dropdown surfaces existing suggestions filtered by the current query so
 * the same name (e.g. "Claude") converges across rows; the user can also
 * commit a new tag with Enter or comma. Hidden inputs emit one entry per
 * selected tag so a Server Action reads them via formData.getAll(inputName).
 *
 * The input is a WAI-ARIA combobox: ArrowUp/ArrowDown move the active-row
 * highlight (starting un-highlighted so plain Enter commits the typed
 * text), Enter selects the highlighted row, Escape closes the dropdown
 * (without bubbling to a parent Dialog). At maxTags the input stays
 * focused/enabled and further entry is simply ignored.
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
  // -1 = nothing highlighted; plain Enter then commits the typed query.
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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

  const trimmedQuery = query.trim();
  const showNewRow =
    trimmedQuery.length > 0 &&
    !normalizedSelected.has(trimmedQuery.toLowerCase()) &&
    !matches.some((m) => m.toLowerCase() === trimmedQuery.toLowerCase());
  // Flat option list for keyboard navigation: suggestion rows first, then
  // the "Add new" row when the query doesn't match anything.
  const optionCount = matches.length + (showNewRow ? 1 : 0);

  const atMax = selected.length >= maxTags;
  const dropdownVisible = open && !atMax && optionCount > 0;

  const clampedActiveIndex = Math.min(activeIndex, optionCount - 1);
  const activeOptionId =
    dropdownVisible && clampedActiveIndex >= 0
      ? `${listboxId}-option-${clampedActiveIndex}`
      : undefined;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Keep the highlighted row visible while arrowing through the list.
  useEffect(() => {
    if (!activeOptionId) return;
    document
      .getElementById(activeOptionId)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  function add(rawTag: string) {
    const tag = rawTag.trim();
    if (!tag) return;
    if (selected.length >= maxTags) return;
    if (normalizedSelected.has(tag.toLowerCase())) return;
    onChange([...selected, tag]);
    setQuery("");
    setActiveIndex(-1);
  }

  function remove(tag: string) {
    const lower = tag.trim().toLowerCase();
    onChange(selected.filter((t) => t.trim().toLowerCase() !== lower));
  }

  function selectOption(index: number) {
    if (index < matches.length) add(matches[index]);
    else add(query);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex(Math.min(optionCount - 1, clampedActiveIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!dropdownVisible) return;
      setActiveIndex(Math.max(-1, clampedActiveIndex - 1));
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (e.key === "Enter" && dropdownVisible && clampedActiveIndex >= 0) {
        selectOption(clampedActiveIndex);
      } else {
        add(query);
      }
    } else if (e.key === "Escape") {
      // Close only our dropdown; stop the event so a parent Dialog doesn't
      // also close. When the dropdown is already closed, let it bubble.
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (
      e.key === "Backspace" &&
      query.length === 0 &&
      selected.length > 0
    ) {
      e.preventDefault();
      remove(selected[selected.length - 1]);
    }
  }

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
              <span className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-0.5 text-xs text-foreground">
                <span className="truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={`Remove ${tag}`}
                  className="-my-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          type="text"
          role="combobox"
          aria-expanded={dropdownVisible}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={atMax ? `Up to ${maxTags} tools` : placeholder}
          aria-label="Add a tool"
        />

        {dropdownVisible && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Tag suggestions"
              className="max-h-60 divide-y divide-border overflow-y-auto"
            >
              {matches.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    id={`${listboxId}-option-${i}`}
                    role="option"
                    aria-selected={i === clampedActiveIndex}
                    tabIndex={-1}
                    onClick={() => add(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      i === clampedActiveIndex && "bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {s}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Add
                    </span>
                  </button>
                </li>
              ))}
              {showNewRow && (
                <li>
                  <button
                    type="button"
                    id={`${listboxId}-option-${matches.length}`}
                    role="option"
                    aria-selected={matches.length === clampedActiveIndex}
                    tabIndex={-1}
                    onClick={() => add(query)}
                    onMouseEnter={() => setActiveIndex(matches.length)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      matches.length === clampedActiveIndex && "bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      Add &ldquo;{trimmedQuery}&rdquo;
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      New
                    </span>
                  </button>
                </li>
              )}
            </ul>
            <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
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
