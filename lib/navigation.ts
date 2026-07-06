import {
  LayoutDashboardIcon,
  WorkflowIcon,
  SparklesIcon,
  LightbulbIcon,
  GraduationCapIcon,
  UsersIcon,
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

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { href: "/interventions", label: "Initiatives", icon: SparklesIcon },
  { href: "/suggestions", label: "Suggestions", icon: LightbulbIcon },
  { href: "/learn", label: "Learn", icon: GraduationCapIcon },
  { href: "/map", label: "People", icon: UsersIcon },
];

/** Appended after NAV_ITEMS only when the viewer can see /admin. */
export const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheckIcon,
};

/**
 * Shared active-route test: exact match for the dashboard root, prefix
 * match (with a path-segment boundary) for everything else.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
