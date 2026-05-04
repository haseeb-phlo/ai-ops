"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_TEAMS = "all";

export function TeamFilter({
  teams,
  value,
  userTeam,
}: {
  teams: string[];
  value: string;
  userTeam: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function handleChange(next: string | null) {
    if (!next) return;
    const sp = new URLSearchParams(params);
    sp.set("team", next);
    router.push(`/workflows?${sp.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Team:</span>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
              {t === userTeam && " (yours)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
