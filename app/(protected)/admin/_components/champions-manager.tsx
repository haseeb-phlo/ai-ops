"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  assignChampion,
  type AssignChampionState,
} from "../_actions/champions";
import { TRAFFIC_STYLE, trafficFor } from "./champions-freshness";

const initial: AssignChampionState = { kind: "idle" };

export type Person = {
  id: string;
  display_name: string;
  email: string;
  team: string;
};

export type ExistingChampion = {
  id: string;
  team: string;
  display_name: string;
  email: string | null;
  user_id: string | null;
  last_check_in: string | null;
};

/**
 * Admin tab manager for AI Champions. Pick a team, see who's already a
 * champion of it, add another or remove one. The "add" picker is search-
 * first so non-canonical team names (e.g. "Tech" vs "Technology") still
 * surface the directory - the previous strict `people.team === team`
 * filter silently produced empty dropdowns when those values diverged.
 */
export function ChampionsManager({
  teams,
  people,
  existing,
}: {
  teams: string[];
  people: Person[];
  existing: ExistingChampion[];
}) {
  const [team, setTeam] = useState<string>("");
  const [picked, setPicked] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const teamSelectId = useId();
  const searchInputId = useId();

  const championsByTeam = useMemo(() => {
    const m = new Map<string, ExistingChampion[]>();
    for (const c of existing) {
      const arr = m.get(c.team) ?? [];
      arr.push(c);
      m.set(c.team, arr);
    }
    return m;
  }, [existing]);

  const championsForSelected = useMemo(
    () => championsByTeam.get(team) ?? [],
    [championsByTeam, team],
  );

  // Already-a-champion guard for the picker, keyed on email now that the
  // champions table stores it. Rows saved before the email column existed
  // (and not covered by the migration backfill) fall back to a display-name
  // match; the durable guard is server-side in assignChampion (email match
  // + the (team, lower(email)) unique index).
  const existingEmails = useMemo(
    () =>
      new Set(
        championsForSelected
          .map((c) => c.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e)),
      ),
    [championsForSelected],
  );
  const legacyNames = useMemo(
    () =>
      new Set(
        championsForSelected
          .filter((c) => !c.email)
          .map((c) => c.display_name.trim().toLowerCase()),
      ),
    [championsForSelected],
  );

  // All directory people, with members of the selected team surfaced first
  // when the search field is empty. Already-champion rows are filtered out
  // server-side AND here so the picker is action-oriented.
  const allCandidates = useMemo(() => {
    const lowerTeam = team.toLowerCase();
    const isOnTeam = (p: Person) => p.team.toLowerCase() === lowerTeam;
    const filtered = people.filter(
      (p) =>
        !existingEmails.has(p.email.trim().toLowerCase()) &&
        !legacyNames.has(p.display_name.trim().toLowerCase()),
    );
    return [
      ...filtered.filter(isOnTeam),
      ...filtered.filter((p) => !isOnTeam(p)),
    ];
  }, [people, team, existingEmails, legacyNames]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCandidates;
    return allCandidates.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q),
    );
  }, [allCandidates, search]);

  const visibleMatches = useMemo(() => matches.slice(0, 50), [matches]);

  // Clamp on render rather than resetting in an effect so a shrinking match
  // list can't leave the highlight pointing past the end.
  const clampedActiveIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, visibleMatches.length - 1),
  );
  const activeOptionId =
    open && !picked && visibleMatches.length > 0
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

  // Submission runs through a transition so we can react to the result
  // inline: success clears the picked person (the same submission can't be
  // replayed into a duplicate-key error) and the confirmation expires on a
  // timer or on the next interaction.
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<AssignChampionState>(initial);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (expireTimer.current) clearTimeout(expireTimer.current);
    },
    [],
  );

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await assignChampion(initial, formData);
      setNotice(result);
      if (result.kind === "ok") {
        setPicked(null);
        setSearch("");
        if (expireTimer.current) clearTimeout(expireTimer.current);
        expireTimer.current = setTimeout(
          () => setNotice({ kind: "idle" }),
          6000,
        );
      }
    });
  }

  function clearNotice() {
    if (expireTimer.current) clearTimeout(expireTimer.current);
    setNotice((n) => (n.kind === "idle" ? n : { kind: "idle" }));
  }

  function pick(p: Person) {
    setPicked(p);
    setSearch("");
    setOpen(false);
    clearNotice();
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex(Math.min(visibleMatches.length - 1, clampedActiveIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return;
      setActiveIndex(Math.max(0, clampedActiveIndex - 1));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const active = visibleMatches[clampedActiveIndex];
      if (active) pick(active);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="space-y-5 rounded-lg border border-border bg-background p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Assign a new champion
        </h2>
        <p className="text-xs leading-normal text-muted-foreground">
          Pick a team and a person from the directory. Existing champions
          appear in the &ldquo;All champions&rdquo; table below, where you
          can also remove.
        </p>
      </div>

      <div className="space-y-1">
        <Label
          htmlFor={teamSelectId}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Team <span aria-hidden>*</span>
        </Label>
        <Select
          value={team === "" ? null : team}
          onValueChange={(v) => {
            setTeam(typeof v === "string" ? v : "");
            setPicked(null);
            setSearch("");
            clearNotice();
          }}
        >
          <SelectTrigger id={teamSelectId} className="sm:max-w-sm">
            {/* Custom render so the "· n champions" annotation in the list
                items never leaks into the closed trigger. */}
            <SelectValue placeholder="Choose a team…">
              {(value: string | null) => value || "Choose a team…"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => {
              const count = championsByTeam.get(t)?.length ?? 0;
              return (
                <SelectItem key={t} value={t}>
                  <span>{t}</span>
                  {count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · {count} {count === 1 ? "champion" : "champions"}
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {team !== "" && (
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current champions of {team}
          </p>
          {championsForSelected.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No champions yet - add the first one below.
            </p>
          ) : (
            <ul className="space-y-1">
              {championsForSelected.map((c) => {
                const { traffic, label } = trafficFor(c.last_check_in);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 text-xs text-foreground"
                  >
                    <span
                      className={`inline-block size-2 shrink-0 rounded-full ${TRAFFIC_STYLE[traffic]}`}
                      aria-label={label}
                      role="img"
                    />
                    <span className="truncate">{c.display_name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <form action={submit} className="space-y-3">
        <input type="hidden" name="team" value={team} />
        <input type="hidden" name="person_id" value={picked?.id ?? ""} />

        <Label
          htmlFor={searchInputId}
          className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Add a champion
        </Label>

        <div ref={containerRef} className="relative">
          {picked ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {picked.display_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[picked.team, picked.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <Input
              id={searchInputId}
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
                clearNotice();
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder={
                allCandidates.length === 0
                  ? "Everyone in the directory is already a champion"
                  : "Search by name, team, or email"
              }
            />
          )}

          {open && !picked && allCandidates.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-md">
              <div className="max-h-60 overflow-y-auto">
                {visibleMatches.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    No matches.
                  </div>
                ) : (
                  <ul
                    id={listboxId}
                    role="listbox"
                    aria-label="People"
                    className="divide-y divide-border"
                  >
                    {visibleMatches.map((p, i) => {
                      const active = i === clampedActiveIndex;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            id={`${listboxId}-option-${i}`}
                            role="option"
                            aria-selected={active}
                            tabIndex={-1}
                            onClick={() => pick(p)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40",
                              active && "bg-muted",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-foreground">
                                {p.display_name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[p.team, p.email].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {matches.length > 50 && (
                <div className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  Showing first 50 - keep typing to narrow.
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          loading={pending}
          disabled={pending || !team || !picked}
        >
          {pending ? "Saving…" : "Add champion"}
        </Button>
      </form>

      {notice.kind === "ok" && (
        <div className="space-y-2">
          <Alert variant="success" className="text-xs">
            Added a champion to <strong>{notice.team}</strong>
            {notice.emailed ? ". Email sent." : "."}
          </Alert>
          {notice.emailNote && (
            <Alert variant="warning" className="text-xs">
              {notice.emailNote}
            </Alert>
          )}
        </div>
      )}
      {notice.kind === "error" && (
        <Alert variant="destructive" className="text-xs">
          {notice.message}
        </Alert>
      )}
    </div>
  );
}
