import type { SessionUser } from "@/lib/auth";
import { alertVariants } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ViewAsSwitcher, type ImpersonableOption } from "./view-as-switcher";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  member: "Member",
};

export function ImpersonationBanner({
  user,
  teams,
  impersonableUsers,
}: {
  user: SessionUser;
  teams: string[];
  impersonableUsers: ImpersonableOption[];
}) {
  if (user.realRole !== "super_admin" || !user.isImpersonating) return null;

  const isUserMode = user.viewAsMode === "user";

  return (
    // Composes the Alert warning variant's tokens onto a full-width,
    // sticky banner: it stays visible while scrolled (the "writes are
    // blocked" warning must not scroll away) at z-40 - above page content,
    // below dialogs/palette (z-50).
    <div
      role="status"
      className={cn(
        alertVariants({ variant: "warning" }),
        "sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-2 sm:px-6",
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
        <span>
          {isUserMode ? (
            <>
              Viewing as <strong>{user.displayName}</strong>{" "}
              <span className="opacity-80">
                ({ROLE_LABEL[user.role] ?? user.role}
                {user.team ? `, ${user.team}` : ""})
              </span>
              . Super-admin powers are hidden and mutations are blocked until you exit.
            </>
          ) : (
            <>
              Viewing as <strong>{ROLE_LABEL[user.role] ?? user.role}</strong>
              {user.team ? (
                <>
                  {" "}on <strong>{user.team}</strong>
                </>
              ) : null}
              . Super-admin powers are hidden until you exit.
            </>
          )}
        </span>
      </span>
      <ViewAsSwitcher
        role={user.role}
        team={user.team}
        isImpersonating={user.isImpersonating}
        teams={teams}
        realRole={user.realRole}
        impersonableUsers={impersonableUsers}
        impersonatedUserId={user.impersonatedUserId}
      />
    </div>
  );
}
