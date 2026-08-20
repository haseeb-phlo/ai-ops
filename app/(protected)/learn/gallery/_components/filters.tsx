"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Filters live in the URL so a filtered view is shareable and survives a
 * refresh - the same reasoning as the admin tabs.
 */
export function GalleryFilters({
  cohorts,
  teams,
  activeCohort,
  activeTeam,
}: {
  cohorts: string[];
  teams: string[];
  activeCohort: string | null;
  activeTeam: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`/learn/gallery?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <FilterGroup
        label="Cohort"
        values={cohorts}
        active={activeCohort}
        onSelect={(v) => setParam("cohort", v)}
      />
      <FilterGroup
        label="Team"
        values={teams}
        active={activeTeam}
        onSelect={(v) => setParam("team", v)}
      />
    </div>
  );
}

function FilterGroup({
  label,
  values,
  active,
  onSelect,
}: {
  label: string;
  values: string[];
  active: string | null;
  onSelect: (value: string | null) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Chip label="All" selected={active === null} onClick={() => onSelect(null)} />
      {values.map((v) => (
        <Chip
          key={v}
          label={v}
          selected={active === v}
          onClick={() => onSelect(v)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition",
        selected
          ? "border-primary bg-secondary text-secondary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
