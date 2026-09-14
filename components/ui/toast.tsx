"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "neutral";

/* The spine is the status-dot rule applied to a rectangle: the semantic hue is
   confined to a 2px edge and the body stays ink-on-white. A tinted surface
   would be the wash the system bans everywhere else. */
const SPINE: Record<ToastTone, string> = {
  success: "bg-success",
  error: "bg-destructive",
  neutral: "bg-border",
};

/**
 * A floating notification: white surface, level-2 elevation, 2px semantic spine.
 *
 * White rather than cream on purpose. Every in-page panel shares the canvas
 * colour and is told apart by its hairline, so a cream toast would read as part
 * of the page it is floating over. Lifting to `--card` is what says "this is
 * above the sheet", and it is the same step dialogs and popovers take.
 *
 * Presentation only - the caller owns visibility, timing and the live region,
 * because a toast triggered by a route param and one triggered by an action
 * have nothing in common except how they look.
 */
export function Toast({
  tone = "neutral",
  onDismiss,
  dismissLabel = "Dismiss notification",
  className,
  children,
}: {
  tone?: ToastTone;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-lg bg-card py-2 pl-3 pr-1.5 text-sm text-card-foreground shadow-md",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-0.5", SPINE[tone])}
      />
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  );
}
