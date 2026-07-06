import { SegmentedControl } from "@/components/ui/segmented-control";

const VIEWS = [
  { value: "map", label: "Map" },
  { value: "directory", label: "Directory" },
] as const;

export type ViewKey = (typeof VIEWS)[number]["value"];

export const DEFAULT_VIEW: ViewKey = "map";

export function ViewToggle({ active }: { active: ViewKey }) {
  // View-scoped params (team, q) are filter state, not view identity, so
  // switching the top-level view drops them. Each tab opens in its
  // canonical default state instead of inheriting stale filters.
  // SegmentedControl's link mode (every option has an href) renders Next
  // Links with aria-current="page" on the active view.
  return (
    <SegmentedControl
      value={active}
      aria-label="People view"
      className="w-auto"
      options={VIEWS.map((v) => ({
        value: v.value,
        label: v.label,
        href: `/map?view=${v.value}`,
      }))}
    />
  );
}
