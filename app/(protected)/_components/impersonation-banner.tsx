import type { SessionUser } from "@/lib/auth";
import { ViewAsSwitcher } from "./view-as-switcher";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  member: "Member",
};

export function ImpersonationBanner({
  user,
  teams,
}: {
  user: SessionUser;
  teams: string[];
}) {
  if (user.realRole !== "super_admin" || !user.isImpersonating) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
        <span>
          Viewing as{" "}
          <strong>{ROLE_LABEL[user.role] ?? user.role}</strong>
          {user.team ? (
            <>
              {" "}on <strong>{user.team}</strong>
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
  );
}
