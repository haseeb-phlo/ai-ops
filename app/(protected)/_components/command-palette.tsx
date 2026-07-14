"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  SearchIcon,
  WorkflowIcon,
  SparklesIcon,
  LightbulbIcon,
  GraduationCapIcon,
  UsersIcon,
  LayoutDashboardIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEM } from "@/lib/navigation";
import type { SearchHit } from "@/app/api/search/index/route";

type StaticHit = {
  id: string;
  kind: "nav";
  title: string;
  subtitle: string | null;
  href: string;
};

type AnyHit = SearchHit | StaticHit;

// "Go to …" entries derive from the canonical nav vocabulary so the
// palette can never drift from the sidebar / mobile menu.
const NAV_HITS: StaticHit[] = [
  ...NAV_ITEMS.map((item) => ({
    id: `nav:${item.href}`,
    kind: "nav" as const,
    title: `Go to ${item.label}`,
    subtitle: item.href === "/" ? "Home" : null,
    href: item.href,
  })),
  {
    id: "nav:profile",
    kind: "nav",
    title: "Edit your profile",
    subtitle: null,
    href: "/profile",
  },
];

const ADMIN_NAV_HIT: StaticHit = {
  id: `nav:${ADMIN_NAV_ITEM.href}`,
  kind: "nav",
  title: `Go to ${ADMIN_NAV_ITEM.label}`,
  subtitle: null,
  href: ADMIN_NAV_ITEM.href,
};

const KIND_LABEL: Record<AnyHit["kind"], string> = {
  nav: "Navigate",
  workflow: "Workflows",
  intervention: "Initiatives",
  suggestion: "Suggestions",
  video: "Learn",
  person: "People",
};

const KIND_ICON: Record<AnyHit["kind"], LucideIcon> = {
  nav: LayoutDashboardIcon,
  workflow: WorkflowIcon,
  intervention: SparklesIcon,
  suggestion: LightbulbIcon,
  video: GraduationCapIcon,
  person: UsersIcon,
};

const KIND_ORDER: AnyHit["kind"][] = [
  "nav",
  "workflow",
  "intervention",
  "suggestion",
  "video",
  "person",
];

type CommandPaletteContextValue = { open: () => void };

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used inside <CommandPalette>",
    );
  }
  return ctx;
}

/**
 * Platform detection for shortcut hints ("⌘K" on macOS/iOS, "Ctrl K"
 * elsewhere). Defaults to macOS on the server render and corrects after
 * mount - useEffect (not a state initializer) so the hydration pass
 * matches the server HTML.
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    const platform =
      (navigator as { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ??
      navigator.platform ??
      "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);
  return isMac;
}

export function CommandPalette({
  canSeeAdmin,
  children,
}: {
  canSeeAdmin: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const listboxId = useId();
  const isMac = useIsMac();

  // Loading is derived rather than stored: the dialog is loading whenever
  // it's open and we haven't yet received a hits payload (and the fetch
  // hasn't failed). This sidesteps a setState-in-effect ahead of the fetch.
  const loading = open && hits === null && !fetchFailed;

  // Reset transient state every time the dialog flips open. Doing this
  // here (rather than in an effect) keeps React 19's set-state-in-effect
  // rule happy.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  // Stable callback exposed via context so other components (sidebar hint,
  // mobile top bar search button) can open the palette without
  // synthesizing keystrokes.
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const contextValue = useMemo<CommandPaletteContextValue>(
    () => ({ open: openPalette }),
    [openPalette],
  );

  // Global ⌘K / Ctrl-K listener. The user's OS keyboard layout decides
  // which modifier; metaKey covers macOS, ctrlKey covers Windows/Linux.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isOpenChord =
        (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isOpenChord) {
        e.preventDefault();
        handleOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Fetch the index lazily on first open. The browser cache (private,
  // max-age=60) absorbs re-opens within the minute. A failure flips
  // `fetchFailed` (rather than caching an empty index for the session) so
  // the Retry button below can clear it and re-run this effect.
  useEffect(() => {
    if (!open || hits !== null || fetchFailed) return;
    let cancelled = false;
    fetch("/api/search/index", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`search index ${r.status}`);
        return r.json();
      })
      .then((data: { hits: SearchHit[] }) => {
        if (cancelled) return;
        setHits(data.hits);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, hits, fetchFailed]);

  const filteredHits = useMemo(() => {
    const allHits: AnyHit[] = [
      ...NAV_HITS,
      ...(canSeeAdmin ? [ADMIN_NAV_HIT] : []),
      ...(hits ?? []),
    ];
    const q = query.trim().toLowerCase();
    if (!q) {
      return allHits.slice(0, 50);
    }
    // Lightweight scoring: prefix matches rank above substring matches;
    // ties broken by title length so shorter titles win (fewer chars left
    // unmatched means a more precise match).
    return allHits
      .map((h) => {
        const t = h.title.toLowerCase();
        const score = t.startsWith(q) ? 0 : t.includes(q) ? 1 : -1;
        return { h, score };
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.h.title.length - b.h.title.length;
      })
      .map((r) => r.h)
      .slice(0, 50);
  }, [hits, query, canSeeAdmin]);

  // Group hits by kind (keeping the master ordering above), assigning each
  // hit its flattened index as we go so the render loop and keyboard
  // navigation never have to search for positions.
  const { grouped, flat } = useMemo(() => {
    const byKind = new Map<AnyHit["kind"], AnyHit[]>();
    for (const h of filteredHits) {
      const list = byKind.get(h.kind) ?? [];
      list.push(h);
      byKind.set(h.kind, list);
    }
    let idx = 0;
    const groups = KIND_ORDER.filter((k) => byKind.has(k)).map((k) => ({
      kind: k,
      items: byKind.get(k)!.map((hit) => ({ hit, idx: idx++ })),
    }));
    return {
      grouped: groups,
      flat: groups.flatMap((g) => g.items.map((i) => i.hit)),
    };
  }, [filteredHits]);

  // The clamp is computed on render so typing into the input shrinking the
  // result set doesn't leave activeIndex pointing past the end.
  const clampedActiveIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, flat.length - 1),
  );
  const optionId = (idx: number) => `${listboxId}-option-${idx}`;
  const activeOptionId = flat.length > 0 ? optionId(clampedActiveIndex) : undefined;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) =>
        Math.min(flat.length - 1, Math.max(0, i) + 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, Math.max(0, i) - 1));
    } else if (e.key === "Home") {
      // No preventDefault: let the caret jump to the start of the input
      // too - both behaviors are what the key means in each context.
      setActiveIndex(0);
    } else if (e.key === "End") {
      setActiveIndex(Math.max(0, flat.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[clampedActiveIndex];
      if (hit) {
        navigateTo(hit.href);
      }
    }
  }

  function navigateTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  // Scroll the active item into view as the user moves through the list.
  // The options carry scroll-mt matching the sticky group-header height so
  // arrowing upward never hides the active row underneath a header.
  useEffect(() => {
    if (!open || !activeOptionId) return;
    document
      .getElementById(activeOptionId)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeOptionId]);

  const modKeyLabel = isMac ? "⌘" : "Ctrl";

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-foreground/25 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <SearchIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              aria-label="Search"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Search workflows, initiatives, people…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              esc
            </kbd>
          </div>

          {fetchFailed && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground"
            >
              <span>Couldn&apos;t load search results.</span>
              <button
                type="button"
                onClick={() => setFetchFailed(false)}
                className="shrink-0 rounded-md border border-border px-2 py-1 font-medium text-foreground outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Retry
              </button>
            </div>
          )}

          <ul
            id={listboxId}
            className="max-h-[min(60vh,32rem)] overflow-y-auto py-1"
            role="listbox"
            aria-label="Search results"
          >
            {loading ? (
              <li
                role="presentation"
                className="px-4 py-8 text-center text-xs text-muted-foreground"
              >
                Loading…
              </li>
            ) : flat.length === 0 ? (
              <li
                role="presentation"
                className="px-4 py-8 text-center text-xs text-muted-foreground"
              >
                {query
                  ? `No matches for "${query}"`
                  : "Type to search workflows, initiatives, people, and more."}
              </li>
            ) : (
              grouped.map((group) => {
                const Icon = KIND_ICON[group.kind];
                const headerId = `${listboxId}-group-${group.kind}`;
                return (
                  <li key={group.kind} role="presentation">
                    <p
                      id={headerId}
                      className="sticky top-0 z-10 bg-popover px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {KIND_LABEL[group.kind]}
                    </p>
                    <ul role="group" aria-labelledby={headerId}>
                      {group.items.map(({ hit, idx }) => {
                        const active = idx === clampedActiveIndex;
                        return (
                          <li key={`${hit.kind}:${hit.id}`} role="presentation">
                            <button
                              type="button"
                              id={optionId(idx)}
                              role="option"
                              aria-selected={active}
                              tabIndex={-1}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => navigateTo(hit.href)}
                              className={cn(
                                // scroll-mt-7 ≈ the sticky group header
                                // (py-1 + 10px line) so scrollIntoView
                                // clears it when arrowing upward.
                                "flex w-full scroll-mt-7 items-center gap-3 px-3 py-2 text-left text-sm",
                                active
                                  ? "bg-muted text-foreground"
                                  : "text-foreground hover:bg-muted/60",
                              )}
                            >
                              <Icon
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {hit.title}
                                </p>
                                {hit.subtitle && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {hit.subtitle}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <Hint label="↑↓" />
              <span>navigate</span>
              <Hint label="↵" />
              <span>open</span>
              <Hint label="esc" />
              <span>close</span>
            </span>
            <span className="hidden sm:inline">
              Press <Kbd>{modKeyLabel}</Kbd>
              <Kbd>K</Kbd> anywhere to reopen
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandPaletteContext.Provider>
  );
}

function Hint({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-popover px-1 font-medium text-foreground">
      {label}
    </kbd>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-popover px-1 font-medium text-foreground">
      {children}
    </kbd>
  );
}

/**
 * Discoverability button you can drop anywhere inside the CommandPalette
 * provider tree - clicking it opens the palette without needing to know
 * the keyboard shortcut.
 */
export function CommandPaletteHint() {
  const { open } = useCommandPalette();
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open command palette"
    >
      <SearchIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">Search AI Ops…</span>
      <kbd className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <span>{isMac ? "⌘" : "Ctrl"}</span>
        <span>K</span>
      </kbd>
    </button>
  );
}
