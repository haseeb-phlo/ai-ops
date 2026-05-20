"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  WorkflowIcon,
  SparklesIcon,
  LightbulbIcon,
  GraduationCapIcon,
  UsersIcon,
  ShieldCheckIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LogOutIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { setSidebarCollapsed } from "@/lib/sidebar-actions";
import { CommandPaletteHint, useCommandPalette } from "./command-palette";

type Item = { href: string; label: string; icon: LucideIcon };

const ITEMS: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { href: "/interventions", label: "AI Initiatives", icon: SparklesIcon },
  { href: "/suggestions", label: "Suggestions", icon: LightbulbIcon },
  { href: "/learn", label: "Learn", icon: GraduationCapIcon },
  { href: "/map", label: "People", icon: UsersIcon },
];

const ADMIN_ITEM: Item = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheckIcon,
};

export function Sidebar({
  user,
  canSeeAdmin,
  initialCollapsed,
}: {
  user: SessionUser;
  canSeeAdmin: boolean;
  initialCollapsed: boolean;
}) {
  // Optimistic local state so the click feels instant. The Server Action
  // persists the cookie so the next render of the layout matches; no
  // revalidatePath needed because the layout reads this once per request
  // and the visible width is driven by client state during the session.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();
  const pathname = usePathname() ?? "/";

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(() => {
      void setSidebarCollapsed(next);
    });
  }

  return (
    <aside
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "group hidden md:flex shrink-0 flex-col border-r border-border bg-background transition-[width] duration-150 ease-out",
        collapsed ? "w-[60px]" : "w-60",
      )}
    >
      {/* Brand row - holds the logo and (when expanded) a hover-revealed
          collapse toggle on the right. The expand affordance lives just
          below this row when the sidebar is collapsed. */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "gap-3 px-4",
        )}
      >
        <Link
          href="/"
          aria-label="Phlo AI Ops home"
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !collapsed && "flex-1",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phlo-mark.svg"
            alt="Phlo"
            className="h-5 w-auto shrink-0"
          />
          {!collapsed && (
            <>
              <span aria-hidden className="h-4 w-px bg-border" />
              <span className="truncate text-sm font-medium tracking-tight text-muted-foreground">
                AI Ops
              </span>
            </>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Collapse sidebar"
            aria-pressed={collapsed}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted/40 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          >
            <ChevronsLeftIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Expand sidebar"
            aria-pressed={collapsed}
            title="Expand sidebar"
            className="flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronsRightIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Search hint - opens the command palette */}
      <div className="px-2 pt-3">
        {collapsed ? <CommandPaletteIconButton /> : <CommandPaletteHint />}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {ITEMS.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
        {canSeeAdmin && (
          <SidebarLink
            item={ADMIN_ITEM}
            active={isActive(ADMIN_ITEM.href)}
            collapsed={collapsed}
          />
        )}
      </nav>

      {/* User block */}
      <div className="border-t border-border p-2">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0",
          )}
          aria-label="Edit profile"
          title={collapsed ? `${user.displayName} · profile` : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatarUrl}
            alt=""
            aria-hidden
            className="size-7 shrink-0 rounded-full ring-1 ring-border"
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user.displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user.role === "super_admin"
                  ? "Super admin"
                  : user.team ?? "Member"}
              </p>
            </div>
          )}
        </Link>

        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0",
            )}
            aria-label="Sign out"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOutIcon className="size-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}

function CommandPaletteIconButton() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open command palette"
      title="Search (⌘K)"
      className="flex w-full items-center justify-center rounded-md px-0 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SearchIcon className="size-4" aria-hidden />
    </button>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-muted font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-r-full before:bg-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
