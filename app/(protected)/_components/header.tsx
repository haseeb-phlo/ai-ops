import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { toTitle } from "@/lib/utils";
import { ViewAsSwitcher } from "./view-as-switcher";

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800 ring-purple-200",
  member: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function Header({
  user,
  teams,
}: {
  user: SessionUser;
  teams: string[];
}) {
  const roleClass = ROLE_STYLES[user.role] ?? ROLE_STYLES.member;
  // Switcher bar: gated on the real role so a super-admin can always toggle
  // back out of impersonation.
  const isReallySuperAdmin = user.realRole === "super_admin";
  // Admin link: gated on the effective role so impersonating "view as member"
  // hides it the same way a real member sees the app.
  const canSeeAdmin = user.role === "super_admin";

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Phlo AI Ops
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600">
            <Link href="/dashboard" className="hover:text-zinc-900">
              Dashboard
            </Link>
            <Link href="/workflows" className="hover:text-zinc-900">
              Workflows
            </Link>
            <Link href="/interventions" className="hover:text-zinc-900">
              Interventions
            </Link>
            <Link href="/map" className="hover:text-zinc-900">
              Map
            </Link>
            <Link href="/people" className="hover:text-zinc-900">
              People
            </Link>
            {canSeeAdmin && (
              <Link href="/admin" className="hover:text-zinc-900">
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-zinc-600">
            <span>{user.displayName}</span>
            {user.team && (
              <>
                <span className="text-zinc-300">·</span>
                <span>{user.team}</span>
              </>
            )}
          </div>

          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${roleClass}`}
          >
            {toTitle(user.role)}
          </span>

          <Link
            href="/profile"
            aria-label="Edit profile"
            className="block size-8 overflow-hidden rounded-full ring-1 ring-zinc-200 hover:ring-zinc-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-full w-full object-cover"
            />
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {isReallySuperAdmin && (
        <div
          className={
            user.isImpersonating
              ? "flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-1.5"
              : "flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-1.5"
          }
        >
          {user.isImpersonating ? (
            <span className="text-xs text-amber-900">
              Viewing as <strong>{toTitle(user.role)}</strong>
              {user.team ? (
                <>
                  {" "}
                  on team <strong>{user.team}</strong>
                </>
              ) : null}
              . You aren&apos;t seeing data through your real super-admin
              permissions.
            </span>
          ) : (
            <span className="text-xs text-zinc-500">
              Super-admin tools - switch how you appear to other parts of the
              app.
            </span>
          )}
          <ViewAsSwitcher
            role={user.role}
            team={user.team}
            isImpersonating={user.isImpersonating}
            teams={teams}
          />
        </div>
      )}
    </>
  );
}
