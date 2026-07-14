import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusStyle } from "@/lib/status";

/**
 * The app's status grammar: a quiet ink-on-card pill whose only colour is a
 * solid 6px dot. Semantic hues never wash a surface - they concentrate in
 * the dot, so a row of mixed statuses reads as typography, not confetti.
 */
export function StatusPill({
  status,
  className,
}: {
  status: StatusStyle;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 bg-card", className)}>
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", status.dotClassName)}
      />
      {status.label}
    </Badge>
  );
}
