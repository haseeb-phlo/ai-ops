"use client";

import { format } from "date-fns";
import { relativeTime } from "@/lib/format";

/**
 * Renders an absolute date in the chosen short format with the full local
 * date + time-of-day on hover so users can always recover the exact moment
 * without us spending pixel budget on it.
 *
 * Client Component on purpose: dates must format in the *viewer's* locale
 * and timezone, not the server's. The server-rendered HTML may briefly show
 * server-local values; `suppressHydrationWarning` lets the client correct
 * them silently on hydration.
 *
 * `relative` switches the visible text to a compact relative form
 * ("3h ago", then a date after ~a month) - the hover tooltip still recovers
 * the exact timestamp.
 */
export function Time({
  iso,
  pattern = "d MMM yyyy",
  className,
  relative = false,
}: {
  iso: string;
  pattern?: string;
  className?: string;
  relative?: boolean;
}) {
  const date = new Date(iso);
  return (
    <time
      dateTime={iso}
      title={date.toLocaleString()}
      className={className}
      suppressHydrationWarning
    >
      {relative ? relativeTime(iso) : format(date, pattern)}
    </time>
  );
}
