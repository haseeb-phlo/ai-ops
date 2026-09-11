"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LogOutIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { navItemsFor, isNavActive, type NavItem } from "@/lib/navigation";
import { Avatar } from "@/components/ui/avatar";
import { setSidebarCollapsed } from "@/lib/sidebar-actions";
import {
  CommandPaletteHint,
  useCommandPalette,
  useIsMac,
} from "./command-palette";

/**
 * Active test for a nav item. Beyond the shared prefix logic, the People
 * item (href /map) also owns the /people/* detail routes, so browsing a
 * person's page keeps People highlighted.
 */
function isItemActive(pathname: string, href: string): boolean {
  if (isNavActive(pathname, href)) return true;
  if (href === "/map") return isNavActive(pathname, "/people");
  return false;
}

export function Sidebar({
  user,
  canSeeAdmin,
  canSeeHackathon,
  initialCollapsed,
}: {
  user: SessionUser;
  canSeeAdmin: boolean;
  canSeeHackathon: boolean;
  initialCollapsed: boolean;
}) {
  // Optimistic local state so the click feels instant. The Server Action
  // persists the cookie so the next render of the layout matches; no
  // revalidatePath needed because the layout reads this once per request
  // and the visible width is driven by client state during the session.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();
  const pathname = usePathname() ?? "/";
  const profileActive = isNavActive(pathname, "/profile");

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
        "group sticky top-0 hidden h-screen md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out",
        collapsed ? "w-[60px]" : "w-60",
      )}
    >
      {/* Brand row - holds the logo and (when expanded) the collapse toggle
          on the right. The expand affordance lives just below this row when
          the sidebar is collapsed. */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "gap-3 px-4",
        )}
      >
        <Link
          href="/"
          aria-label="Phlo AI Ops home"
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
            !collapsed && "flex-1",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phlo-mark.svg"
            alt="Phlo"
            width={60}
            height={20}
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
            className="rounded-md p-1 text-muted-foreground opacity-60 outline-none transition-opacity hover:bg-muted/40 hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary group-hover:opacity-100"
          >
            <ChevronsLeftIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="shrink-0 px-2 pt-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
          >
            <ChevronsRightIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Search hint - opens the command palette */}
      <div className="shrink-0 px-2 pt-3">
        {collapsed ? <CommandPaletteIconButton /> : <CommandPaletteHint />}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {navItemsFor({ canSeeAdmin, canSeeHackathon }).map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isItemActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* User block */}
      <div className="shrink-0 border-t border-border p-2">
        <Link
          href="/profile"
          aria-current={profileActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary",
            profileActive ? "bg-sidebar-accent/60" : "hover:bg-sidebar-accent/40",
            collapsed && "justify-center px-0",
          )}
          aria-label="Edit profile"
          title={collapsed ? `${user.displayName} · profile` : undefined}
        >
          <Avatar
            src={user.avatarUrl}
            name={user.displayName}
            className="size-7 ring-1 ring-border"
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user.displayName}
              </p>
              <p className="truncate text-3xs text-muted-foreground">
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
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary",
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
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open command palette"
      title={`Search (${isMac ? "⌘K" : "Ctrl K"})`}
      className="flex w-full items-center justify-center rounded-md px-0 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
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
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary",
        active
          ? "bg-sidebar-accent/60 font-medium text-sidebar-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-r-full before:bg-sidebar-primary"
          : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
