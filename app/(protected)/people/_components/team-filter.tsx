"use client";

import { useRouter, usePathname } from "next/navigation";
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
}: {
  teams: string[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(next: string | null) {
    const v = next ?? ALL_TEAMS;
    const qs = v === ALL_TEAMS ? "" : `?team=${encodeURIComponent(v)}`;
    router.push(qs ? `${pathname}${qs}` : pathname);
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="min-w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
        {teams.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
