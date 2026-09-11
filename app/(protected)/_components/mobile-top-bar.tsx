"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { navItemsFor, isNavActive } from "@/lib/navigation";
import { Avatar } from "@/components/ui/avatar";
import { useCommandPalette } from "./command-palette";

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

export function MobileTopBar({
  user,
  canSeeAdmin,
  canSeeHackathon,
}: {
  user: SessionUser;
  canSeeAdmin: boolean;
  canSeeHackathon: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const { open: openPalette } = useCommandPalette();

  // Close the open menu on Escape and on clicks/taps outside the bar.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open]);

  const items = navItemsFor({ canSeeAdmin, canSeeHackathon });
  const profileActive = isNavActive(pathname, "/profile");

  const iconButtonClass =
    "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary";

  return (
    <div ref={containerRef} className="md:hidden">
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phlo-mark.svg"
            alt="Phlo"
            width={60}
            height={20}
            className="h-5 w-auto"
          />
          <span aria-hidden className="h-4 w-px bg-border" />
          <span className="text-sm font-medium tracking-tight text-muted-foreground">
            AI Ops
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search"
            className={iconButtonClass}
          >
            <SearchIcon className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            className={iconButtonClass}
          >
            {open ? (
              <XIcon className="size-5" aria-hidden />
            ) : (
              <MenuIcon className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </header>
      {open && (
        <nav id={menuId} className="border-b border-border bg-background px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                      active
                        ? "bg-secondary/60 font-medium text-primary"
                        : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-border pt-1">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                aria-current={profileActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                  profileActive
                    ? "bg-secondary/60 font-medium text-primary"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <Avatar
                  src={user.avatarUrl}
                  name={user.displayName}
                  className="size-5"
                />
                Profile
              </Link>
            </li>
            <li>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
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
