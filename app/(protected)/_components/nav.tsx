"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/workflows", label: "Workflows" },
  { href: "/interventions", label: "AI Initiatives" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/learn", label: "Learn" },
  { href: "/map", label: "People" },
] as const;

export function Nav({ canSeeAdmin }: { canSeeAdmin: boolean }) {
  const pathname = usePathname() ?? "/";

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            isActive(item.href)
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
      {canSeeAdmin && (
        <Link
          href="/admin"
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            isActive("/admin")
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}
