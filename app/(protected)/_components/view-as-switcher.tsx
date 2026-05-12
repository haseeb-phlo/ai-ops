"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setViewAs, clearViewAs } from "@/lib/view-as";

const NO_TEAM = "__none__";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  member: "Member",
};

const ROLE_OPTIONS = ["super_admin", "member"] as const;

export function ViewAsSwitcher({
  role,
  team,
  isImpersonating,
  teams,
  realRole,
}: {
  role: string;
  team: string | null;
  isImpersonating: boolean;
  teams: string[];
  realRole: string;
}) {
  const [isPending, startTransition] = useTransition();

  const teamValue = team ?? NO_TEAM;

  function handleRoleChange(next: string | null) {
    if (!next) return;
    startTransition(async () => {
      // Selecting your real role exits impersonation; selecting any other
      // role enters impersonation as that role.
      if (next === realRole) {
        await clearViewAs();
      } else {
        await setViewAs(next, team);
      }
    });
  }

  function handleTeamChange(next: string | null) {
    if (!next) return;
    if (!isImpersonating) return;
    startTransition(async () => {
      await setViewAs(role, next === NO_TEAM ? null : next);
    });
  }

  function exitImpersonation() {
    startTransition(async () => {
      await clearViewAs();
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">View as</span>
      <Select
        value={role}
        onValueChange={handleRoleChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 px-2 text-xs">
          <SelectValue>
            {(v) => ROLE_LABEL[v as string] ?? "Super admin"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isImpersonating && (
        <>
          <Select
            value={teamValue}
            onValueChange={handleTeamChange}
            disabled={isPending}
          >
            <SelectTrigger className="h-7 px-2 text-xs">
              <SelectValue placeholder="No team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEAM}>No team</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={exitImpersonation}
            disabled={isPending}
            className="rounded-md bg-amber-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-950 disabled:opacity-50"
          >
            Exit view-as
          </button>
        </>
      )}
    </div>
  );
}
