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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { setSidebarCollapsed } from "@/lib/sidebar-actions";

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
        "hidden md:flex shrink-0 flex-col border-r border-border bg-background transition-[width] duration-150 ease-out",
        collapsed ? "w-[60px]" : "w-[224px]",
      )}
    >
      {/* Brand */}
      <Link
        href="/"
        aria-label="Phlo AI Ops home"
        className={cn(
          "flex h-14 items-center gap-2.5 border-b border-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phlo-mark.svg" alt="Phlo" className="h-5 w-auto shrink-0" />
        {!collapsed && (
          <>
            <span aria-hidden className="h-4 w-px bg-muted-foreground/60" />
            <span className="text-sm font-medium tracking-tight text-muted-foreground">
              AI Ops
            </span>
          </>
        )}
      </Link>

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
            "flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40",
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
                {user.role === "super_admin" ? "Super admin" : user.team ?? "Member"}
              </p>
            </div>
          )}
        </Link>

        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label="Sign out"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOutIcon className="size-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </form>

        <button
          type="button"
          onClick={handleToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className={cn(
            "mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRightIcon className="size-4 shrink-0" />
          ) : (
            <ChevronsLeftIcon className="size-4 shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
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
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
