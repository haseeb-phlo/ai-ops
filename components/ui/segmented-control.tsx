"use client";

import { useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedOption = {
  value: string;
  label: string;
  // Tiny mono prefix rendered before the label. Used by the criticality
  // picker to show "1 Trivial", "5 Critical", etc.
  prefix?: string;
  // Optional small icon rendered before the prefix/label.
  icon?: LucideIcon;
  // Link mode: when set (on every option), the control renders as a nav of
  // Next.js Links instead of a radiogroup of buttons. The active option gets
  // aria-current="page". Feature areas use this to replace hand-rolled link
  // toggles while keeping the segmented visual language.
  href?: string;
};

const OPTION_CLASS =
  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary";

function optionClass(active: boolean): string {
  return cn(
    OPTION_CLASS,
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:text-foreground",
  );
}

function OptionLabel({
  option,
  active,
}: {
  option: SegmentedOption;
  active: boolean;
}) {
  return (
    <>
      {option.icon && <option.icon className="size-3.5 shrink-0" aria-hidden />}
      {option.prefix && (
        <span
          className={cn(
            "font-mono text-xs",
            active ? "opacity-60" : "opacity-50",
          )}
        >
          {option.prefix}
        </span>
      )}
      {option.label}
    </>
  );
}

// Rendered inside each Link so useLinkStatus can track that Link's pending
// navigation. Fades in after a beat so instant transitions never flash it.
function LinkPendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="animate-in fade-in motion-reduce:animate-none inline-flex duration-200 delay-150 fill-mode-backwards"
    >
      <Loader2 className="size-3 animate-spin" />
    </span>
  );
}

/**
 * Single-select segmented control.
 *
 * Two modes:
 * - Button mode (default): a radiogroup - `role="radio"` options with
 *   `aria-checked`, roving tabindex, and ArrowLeft/ArrowRight moving the
 *   selection. Requires `onChange`.
 * - Link mode: pass `href` on every option and the control renders as a
 *   `<nav>` of Links with `aria-current="page"` on the active one.
 */
export function SegmentedControl({
  value,
  options,
  onChange,
  className,
  "aria-label": ariaLabel,
  disabled = false,
}: {
  value: string;
  options: readonly SegmentedOption[];
  onChange?: (v: string) => void;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const linkMode = options.length > 0 && options.every((o) => o.href != null);

  const containerClass = cn(
    "flex w-full rounded-lg border border-border bg-background p-0.5",
    disabled && "pointer-events-none opacity-50",
    className,
  );

  if (linkMode) {
    return (
      <nav aria-label={ariaLabel} className={containerClass}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <Link
              key={o.value}
              href={o.href!}
              aria-current={active ? "page" : undefined}
              className={optionClass(active)}
            >
              <OptionLabel option={o} active={active} />
              <LinkPendingSpinner />
            </Link>
          );
        })}
      </nav>
    );
  }

  function moveSelection(fromIndex: number, delta: number) {
    if (options.length === 0) return;
    const next = (fromIndex + delta + options.length) % options.length;
    onChange?.(options[next].value);
    optionRefs.current[next]?.focus();
  }

  const selectedIndex = options.findIndex((o) => o.value === value);

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={containerClass}>
      {options.map((o, i) => {
        const active = value === o.value;
        // Roving tabindex: only the checked option (or the first, when
        // nothing matches) participates in the tab order; arrows move
        // within the group.
        const tabbable = selectedIndex === -1 ? i === 0 : active;
        return (
          <button
            key={o.value}
            ref={(node) => {
              optionRefs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange?.(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                moveSelection(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                moveSelection(i, -1);
              }
            }}
            className={optionClass(active)}
          >
            <OptionLabel option={o} active={active} />
          </button>
        );
      })}
    </div>
  );
}
