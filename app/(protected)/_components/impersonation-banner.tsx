import type { SessionUser } from "@/lib/auth";
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
        <span>
          {isUserMode ? (
            <>
              Viewing as <strong>{user.displayName}</strong>{" "}
              <span className="text-amber-800/80">
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
