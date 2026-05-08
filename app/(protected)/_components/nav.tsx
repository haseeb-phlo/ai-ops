"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/workflows", label: "Workflows" },
  { href: "/interventions", label: "Interventions" },
  { href: "/suggestions", label: "Suggestions" },
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
              ? "bg-zinc-100 font-medium text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900",
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
              ? "bg-zinc-100 font-medium text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900",
          )}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}
