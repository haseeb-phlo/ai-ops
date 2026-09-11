import {
  LayoutDashboardIcon,
  WorkflowIcon,
  SparklesIcon,
  LightbulbIcon,
  KanbanSquareIcon,
  GraduationCapIcon,
  UsersIcon,
  HammerIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Canonical navigation vocabulary for the app chrome.
 *
 * Single source for the sidebar, the mobile top bar, and the command
 * palette's "Go to …" entries - anything that lists the app's sections
 * should import from here rather than re-declaring label/href/icon triples.
 * Plain const module (no "use client") so it's importable from both server
 * and client components; lucide icons are client-safe.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon };

// Ordered by a descending maturity gradient - realized value first, raw
// potential later, context last: impact (Dashboard), the register it's
// measured against (Workflows), work that's live (Initiatives), committed
// (Roadmap), proposed (Suggestions), then enablement (Learn) and reference
// (People). Roadmap sits above Suggestions deliberately: a curated,
// prioritised queue outranks an unfiltered inbox, and the two stay
// adjacent because accepted ideas flow between them.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { href: "/interventions", label: "Initiatives", icon: SparklesIcon },
  { href: "/roadmap", label: "Roadmap", icon: KanbanSquareIcon },
  { href: "/suggestions", label: "Suggestions", icon: LightbulbIcon },
  { href: "/learn", label: "AI Training", icon: GraduationCapIcon },
  { href: "/map", label: "People", icon: UsersIcon },
];

/** Appended after NAV_ITEMS only when the viewer can see /admin. */
export const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheckIcon,
};

/**
 * Appended only for people invited to a hackathon - a cohort at a time, plus
 * super admins. See `lib/hackathon/access.ts`, which is the one place that
 * decides, and whose rules the /hackathon routes enforce as well; a nav item
 * that bounces you is worse than no nav item.
 *
 * Not part of NAV_ITEMS because that list has no per-user filtering: every
 * one of its entries is shown to all 138 people, so adding a gated section
 * there is how you advertise a locked door.
 */
export const HACKATHON_NAV_ITEM: NavItem = {
  href: "/hackathon",
  label: "Hackathon",
  icon: HammerIcon,
};

/**
 * The sections this viewer actually gets, in order.
 *
 * The two conditional tabs sit after the permanent ones and in escalating
 * scope - your own event, then the whole app's administration - which is the
 * same descending-audience logic NAV_ITEMS itself is ordered by. Composed
 * here rather than in each consumer because there are three of them (sidebar,
 * mobile bar, command palette) and they were already spelling the admin case
 * out separately.
 */
export function navItemsFor(input: {
  canSeeHackathon: boolean;
  canSeeAdmin: boolean;
}): readonly NavItem[] {
  return [
    ...NAV_ITEMS,
    ...(input.canSeeHackathon ? [HACKATHON_NAV_ITEM] : []),
    ...(input.canSeeAdmin ? [ADMIN_NAV_ITEM] : []),
  ];
}

/**
 * Shared active-route test: exact match for the dashboard root, prefix
 * match (with a path-segment boundary) for everything else.
 *
 * Also used by the AI Training section strip in
 * `lib/programme/learn-nav.ts`, which is the second level of this
 * vocabulary: the pages inside one section rather than the sections
 * themselves. Nothing else lists app sections; anything that lists the
 * pages inside /learn belongs there, not here.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
