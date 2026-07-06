"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickerPerson = {
  email: string;
  displayName: string;
  team?: string | null;
  title?: string | null;
};

/**
 * Search-first multi-select keyed on canonical email.
 *
 * Selected people render as chips (with a dedicated remove button) above the
 * search field; the matches dropdown only opens while the search is focused
 * or has a query, keeping the surface compact when the user is just
 * reviewing what they've already picked. Hidden inputs emit one entry per
 * selected email so the server action reads them via
 * formData.getAll(inputName).
 *
 * The search input is a WAI-ARIA combobox: ArrowUp/ArrowDown move the
 * active-row highlight, Enter toggles the active row, Escape closes the
 * dropdown (without bubbling to a parent Dialog).
 */
export function PeoplePicker({
  people,
  selected,
  onChange,
  inputName,
  searchPlaceholder = "Search by name, team, or email",
  emptyMessage = "No people in the directory.",
  noMatchMessage = "No matches.",
}: {
  people: PickerPerson[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  inputName?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noMatchMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const peopleByEmail = useMemo(() => {
    const m = new Map<string, PickerPerson>();
    for (const p of people) m.set(p.email, p);
    return m;
  }, [people]);

  const sorted = useMemo(
    () =>
      people
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [people],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? sorted.filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            (p.team ?? "").toLowerCase().includes(q),
        )
      : sorted;
    // Surface unselected matches first so the dropdown is action-oriented.
    return pool.slice().sort((a, b) => {
      const aSel = selected.has(a.email) ? 1 : 0;
      const bSel = selected.has(b.email) ? 1 : 0;
      if (aSel !== bSel) return aSel - bSel;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [sorted, search, selected]);

  // Clamp on render rather than resetting in an effect so a shrinking match
  // list can't leave the highlight pointing past the end.
  const clampedActiveIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, matches.length - 1),
  );
  const activeOptionId =
    open && matches.length > 0
      ? `${listboxId}-option-${clampedActiveIndex}`
      : undefined;

  // Click-outside to close. Re-open whenever the input is focused or the
  // user types - that's the natural mental model for a combobox.
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
    if (!open || !activeOptionId) return;
    document
      .getElementById(activeOptionId)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeOptionId]);

  function add(email: string) {
    if (selected.has(email)) return;
    const next = new Set(selected);
    next.add(email);
    onChange(next);
  }
  function remove(email: string) {
    if (!selected.has(email)) return;
    const next = new Set(selected);
    next.delete(email);
    onChange(next);
  }
  function toggle(email: string) {
    if (selected.has(email)) remove(email);
    else add(email);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex(Math.min(matches.length - 1, clampedActiveIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return;
      setActiveIndex(Math.max(0, clampedActiveIndex - 1));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const active = matches[clampedActiveIndex];
      if (active) toggle(active.email);
    } else if (e.key === "Escape") {
      // Close only our dropdown; stop the event so a parent Dialog doesn't
      // also close. When the dropdown is already closed, let it bubble.
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  const selectedList = Array.from(selected)
    .map((email) => peopleByEmail.get(email))
    .filter((p): p is PickerPerson => !!p)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Hidden inputs: emit one entry per selected email so a Server Action
          reads them via formData.getAll(inputName). */}
      {inputName &&
        Array.from(selected).map((email) => (
          <input key={email} type="hidden" name={inputName} value={email} />
        ))}

      {/* Selected chips: always visible so you can see who you've added.
          The chip is a plain container; only the X removes. */}
      {selectedList.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selectedList.map((p) => (
            <li key={p.email}>
              <span
                className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-0.5 text-xs text-foreground"
                title={p.email}
              >
                <span className="truncate">{p.displayName}</span>
                <button
                  type="button"
                  onClick={() => remove(p.email)}
                  aria-label={`Remove ${p.displayName}`}
                  className="-my-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Search field; the dropdown is anchored beneath it. */}
      <div className="relative">
        <Input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          aria-label="Search people"
        />

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <div className="max-h-60 overflow-y-auto">
              {people.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : matches.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  {noMatchMessage}
                </div>
              ) : (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label="People"
                  className="divide-y divide-border"
                >
                  {matches.map((p, i) => {
                    const checked = selected.has(p.email);
                    const active = i === clampedActiveIndex;
                    return (
                      <li key={p.email}>
                        <button
                          type="button"
                          id={`${listboxId}-option-${i}`}
                          role="option"
                          aria-selected={checked}
                          tabIndex={-1}
                          onClick={() => toggle(p.email)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                            checked && "bg-muted/60 text-muted-foreground",
                            active && "bg-muted",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-foreground">
                              {p.displayName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[p.title, p.team].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {checked ? "Added" : "Add"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
              <span>{selected.size} selected</span>
              <span>Click to {selected.size > 0 ? "add or remove" : "add"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
