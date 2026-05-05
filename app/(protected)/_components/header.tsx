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
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-zinc-900"
          >
            Phlo AI Ops
          </Link>
          <Nav canSeeAdmin={canSeeAdmin} />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 text-zinc-600">
            <span className="font-medium text-zinc-900">
              {user.displayName}
            </span>
            {user.team && (
              <>
                <span className="text-zinc-300">·</span>
                <span>{user.team}</span>
              </>
            )}
            {user.role === "super_admin" && (
              <span
                className="ml-1 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                title="Super admin"
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-purple-500"
                />
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
              className="block size-8 overflow-hidden rounded-full ring-1 ring-zinc-200 hover:ring-zinc-400"
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
              ? "flex items-center justify-between gap-3 border-b-2 border-amber-300 bg-amber-100 px-6 py-2.5"
              : "flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-1.5"
          }
        >
          {user.isImpersonating ? (
            <span className="flex items-center gap-2 text-sm text-amber-900">
              <span
                aria-hidden
                className="inline-flex items-center rounded bg-amber-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-50"
              >
                View-as
              </span>
              <span>
                You&apos;re seeing the app as a{" "}
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
          ) : (
            <span className="text-xs text-zinc-500">
              Super-admin tools — switch how you appear to other parts of the
              app.
            </span>
          )}
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
