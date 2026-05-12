"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption = {
  value: string;
  label: string;
  // Tiny mono prefix rendered before the label. Used by the criticality
  // picker to show "1 Trivial", "5 Critical", etc.
  suffix?: string;
};

export function SegmentedControl({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: readonly SegmentedOption[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full rounded-lg border border-border bg-background p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.suffix && (
              <span
                className={cn(
                  "mr-1 font-mono text-[10px]",
                  active ? "opacity-60" : "opacity-50",
                )}
              >
                {o.suffix}
              </span>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
