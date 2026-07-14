"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setViewAs, setViewAsUser, clearViewAs } from "@/lib/view-as";

const NO_TEAM = "__none__";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  member: "Member",
};

const ROLE_OPTIONS = ["super_admin", "member"] as const;

export type ImpersonableOption = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  team: string | null;
  title: string | null;
};

export function ViewAsSwitcher({
  role,
  team,
  isImpersonating,
  teams,
  realRole,
  impersonableUsers,
  impersonatedUserId,
}: {
  role: string;
  team: string | null;
  isImpersonating: boolean;
  teams: string[];
  realRole: string;
  impersonableUsers: ImpersonableOption[];
  // When in user-impersonation mode, this is the target's user id. Used to
  // label the picker; null in role-only mode.
  impersonatedUserId: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  const teamValue = team ?? NO_TEAM;

  function handleRoleChange(next: string | null) {
    if (!next) return;
    startTransition(async () => {
      // Selecting your real role exits impersonation; selecting any other
      // role enters impersonation as that role.
      if (next === realRole) {
        await clearViewAs();
      } else {
        await setViewAs(next, team);
      }
    });
  }

  function handleTeamChange(next: string | null) {
    if (!next) return;
    if (!isImpersonating) return;
    startTransition(async () => {
      // Switching the team always falls back to role-mode (we no longer
      // know which user "owns" this team-only override).
      await setViewAs(role, next === NO_TEAM ? null : next);
    });
  }

  function exitImpersonation() {
    startTransition(async () => {
      await clearViewAs();
    });
  }

  function handleUserPick(userId: string) {
    startTransition(async () => {
      await setViewAsUser(userId);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">View as</span>
      <Select
        value={role}
        onValueChange={handleRoleChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 px-2 text-xs">
          <SelectValue>
            {(v) => ROLE_LABEL[v as string] ?? "Super admin"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isImpersonating && (
        <Select
          value={teamValue}
          onValueChange={handleTeamChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-7 px-2 text-xs">
            <SelectValue placeholder="No team">
              {(v) => (v === NO_TEAM ? "No team" : (v as string))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TEAM}>No team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <UserPicker
        users={impersonableUsers}
        selectedUserId={impersonatedUserId}
        disabled={isPending}
        onPick={handleUserPick}
      />

      {isImpersonating && (
        <button
          type="button"
          onClick={exitImpersonation}
          disabled={isPending}
          className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background outline-none hover:bg-foreground/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          Exit view-as
        </button>
      )}
    </div>
  );
}

/**
 * Search-first single-select over impersonable users. The search input is
 * a WAI-ARIA combobox (mirrors components/ui/people-picker.tsx):
 * ArrowUp/ArrowDown move the active-row highlight, Enter picks the active
 * row, Escape closes only this dropdown (stopping propagation so parent
 * overlays stay open).
 */
function UserPicker({
  users,
  selectedUserId,
  disabled,
  onPick,
}: {
  users: ImpersonableOption[];
  selectedUserId: string | null;
  disabled: boolean;
  onPick: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => users.find((u) => u.userId === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.team ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

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

  function pick(userId: string) {
    setOpen(false);
    setSearch("");
    onPick(userId);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(Math.min(matches.length - 1, clampedActiveIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(Math.max(0, clampedActiveIndex - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = matches[clampedActiveIndex];
      if (active) pick(active.userId);
    } else if (e.key === "Escape") {
      // Close only our dropdown; stop the event so a parent overlay
      // doesn't also close.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  if (users.length === 0) {
    // Service role key not set on the server, or no eligible users. Hide the
    // picker entirely rather than showing a broken control.
    return null;
  }

  const triggerLabel = selected ? selected.displayName : "Pick a user";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          selected && "border-warning/50 bg-warning/10",
        )}
      >
        <span className="truncate max-w-[180px]">{triggerLabel}</span>
        <span aria-hidden className="text-muted-foreground">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          <div className="border-b border-border p-2">
            <Input
              type="search"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search by name, email, team"
              aria-label="Search users to impersonate"
              className="h-7 text-xs"
            />
          </div>
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              No matches.
            </p>
          ) : (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Users to view as"
              className="max-h-64 divide-y divide-border overflow-y-auto"
            >
              {matches.map((u, i) => {
                const isSel = u.userId === selectedUserId;
                const active = i === clampedActiveIndex;
                return (
                  <li key={u.userId} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-option-${i}`}
                      role="option"
                      aria-selected={isSel}
                      tabIndex={-1}
                      onClick={() => pick(u.userId)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors",
                        isSel && "bg-muted/60 text-muted-foreground",
                        active && "bg-muted",
                        !isSel && !active && "hover:bg-muted/40",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">
                          {u.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[
                            ROLE_LABEL[u.role] ?? u.role,
                            u.team,
                            u.title,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {isSel ? "Active" : "View as"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
