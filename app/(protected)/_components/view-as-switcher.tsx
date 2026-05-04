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
import { toTitle } from "@/lib/utils";

const ROLES = ["super_admin", "member"] as const;
const REAL_VALUE = "__real__";
const NO_TEAM = "__none__";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  member: "Member",
};

export function ViewAsSwitcher({
  role,
  team,
  isImpersonating,
  teams,
}: {
  role: string;
  team: string | null;
  isImpersonating: boolean;
  teams: string[];
}) {
  const [isPending, startTransition] = useTransition();

  const roleValue = isImpersonating ? role : REAL_VALUE;
  const teamValue = team ?? NO_TEAM;

  function handleRoleChange(next: string | null) {
    if (!next) return;
    startTransition(async () => {
      if (next === REAL_VALUE) {
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

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-500">View as</span>
      <Select
        value={roleValue}
        onValueChange={handleRoleChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={REAL_VALUE}>Super admin (you)</SelectItem>
          {ROLES.filter((r) => r !== "super_admin").map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABEL[r] ?? toTitle(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isImpersonating && (
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
      )}
    </div>
  );
}
