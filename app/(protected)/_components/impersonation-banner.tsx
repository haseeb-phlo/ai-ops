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
    // A global-mode banner, not an inline alert: it earns the app's one
    // ambient tint (sand at 10%) because impersonation recolours the whole
    // session, while the text stays ink. Sticky so the "writes are blocked"
    // warning can't scroll away; z-40 - above page content, below
    // dialogs/palette (z-50).
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-warning/25 bg-warning/10 px-4 py-2 text-sm text-foreground sm:px-6"
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
