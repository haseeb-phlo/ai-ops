"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * Selected people render as removable chips above the search field; the
 * matches dropdown only opens while the search is focused or has a query,
 * keeping the surface compact when the user is just reviewing what they've
 * already picked. Hidden inputs emit one entry per selected email so the
 * server action reads them via formData.getAll(inputName).
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
  const containerRef = useRef<HTMLDivElement>(null);

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

      {/* Selected chips: always visible so you can see who you've added. */}
      {selectedList.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selectedList.map((p) => (
            <li key={p.email}>
              <button
                type="button"
                onClick={() => remove(p.email)}
                className="group inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs text-foreground transition-colors hover:border-input hover:bg-muted"
                aria-label={`Remove ${p.displayName}`}
                title={p.email}
              >
                <span className="truncate">{p.displayName}</span>
                <span className="flex size-4 items-center justify-center rounded-full text-muted-foreground group-hover:text-foreground">
                  <X className="size-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Search field; the dropdown is anchored beneath it. */}
      <div className="relative">
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
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
                <ul className="divide-y divide-border">
                  {matches.map((p) => {
                    const checked = selected.has(p.email);
                    return (
                      <li key={p.email}>
                        <button
                          type="button"
                          onClick={() => toggle(p.email)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                            checked
                              ? "bg-muted/60 text-muted-foreground"
                              : "hover:bg-muted/40",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-foreground">
                              {p.displayName}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {[p.title, p.team].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {checked ? "Added" : "Add"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span>{selected.size} selected</span>
              <span>Click to {selected.size > 0 ? "add or remove" : "add"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
