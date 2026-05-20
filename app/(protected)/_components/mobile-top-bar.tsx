"use client";

import { useState } from "react";
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
  MenuIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function MobileTopBar({ canSeeAdmin }: { canSeeAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const items = canSeeAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS;

  return (
    <div className="md:hidden">
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/phlo-mark.svg" alt="Phlo" className="h-5 w-auto" />
          <span aria-hidden className="h-4 w-px bg-muted-foreground/60" />
          <span className="text-sm font-medium tracking-tight text-muted-foreground">
            AI Ops
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </header>
      {open && (
        <nav className="border-b border-border bg-background px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-border pt-1">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
