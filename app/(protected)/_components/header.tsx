import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { findChampionForPerson } from "@/lib/champions";
import { PersonAvatar } from "@/components/people/champion-mark";
import { Nav } from "./nav";
import { ViewAsSwitcher } from "./view-as-switcher";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  member: "Member",
};

export async function Header({
  user,
  teams,
}: {
  user: SessionUser;
  teams: string[];
}) {
  const champion = await findChampionForPerson({
    userId: user.id,
    displayName: user.displayName,
  });
  // Switcher bar: gated on the real role so a super-admin can always toggle
  // back out of impersonation.
  const isReallySuperAdmin = user.realRole === "super_admin";
  const canSeeAdmin = user.role === "super_admin";

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            aria-label="Phlo AI Ops home"
            className="flex items-center gap-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/phlo-mark.svg"
              alt="Phlo"
              className="h-5 w-auto"
            />
            <span aria-hidden className="h-4 w-px bg-muted-foreground/60" />
            <span className="text-sm font-medium tracking-tight text-muted-foreground">
              AI Ops
            </span>
          </Link>
          <Nav canSeeAdmin={canSeeAdmin} />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">
              {user.displayName}
            </span>
            {user.team && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>{user.team}</span>
              </>
            )}
            {user.role === "super_admin" && (
              <span
                className="ml-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium tracking-tight text-muted-foreground"
                title="You have super-admin access"
              >
                Super admin
              </span>
            )}
          </div>

          {champion ? (
            <PersonAvatar
              seed={user.id}
              avatarUrl={user.avatarUrl}
              name={user.displayName}
              champion={champion}
              size={32}
            />
          ) : (
            <Link
              href="/profile"
              aria-label="Edit profile"
              className="block size-8 overflow-hidden rounded-full ring-1 ring-border hover:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-full w-full object-cover"
              />
            </Link>
          )}

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/40"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {isReallySuperAdmin && user.isImpersonating && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-amber-500"
            />
            <span>
              Viewing as{" "}
              <strong>{ROLE_LABEL[user.role] ?? user.role}</strong>
              {user.team ? (
                <>
                  {" "}on{" "}
                  <strong>{user.team}</strong>
                </>
              ) : null}
              . Super-admin powers are hidden until you exit.
            </span>
          </span>
          <ViewAsSwitcher
            role={user.role}
            team={user.team}
            isImpersonating={user.isImpersonating}
            teams={teams}
            realRole={user.realRole}
          />
        </div>
      )}
    </>
  );
}
