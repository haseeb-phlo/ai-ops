"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dayLinkPath } from "@/lib/programme/day-link";
import type { DayLink } from "@/lib/programme/cohort-admin";

/**
 * One link per programme day, to paste into Slack on the morning it opens.
 *
 * The programme is a drip and Slack is where the cohort actually is, so the
 * thing that makes a day happen is a link somebody posts. Before this there
 * was only `/learn/track`, which lands everyone on their own current day -
 * fine for a member opening the app, useless in a channel where the post has
 * to say "today is day 3" and go there.
 *
 * ORIGIN FROM THE BROWSER, not from `appUrl()`. The join link beside this does
 * the same thing, and the reason is that a link copied on a preview deploy
 * should point at that preview - `appUrl()` resolves to the production host,
 * so testing the flow would hand you a URL to somewhere else.
 */
export function DayLinks({ days }: { days: DayLink[] }) {
  const [copiedDay, setCopiedDay] = useState<number | null>(null);

  const hrefFor = (dayIndex: number) =>
    `${typeof window === "undefined" ? "" : window.location.origin}${dayLinkPath(dayIndex)}`;

  const copy = (dayIndex: number) => {
    void navigator.clipboard.writeText(hrefFor(dayIndex));
    setCopiedDay(dayIndex);
    setTimeout(() => setCopiedDay((d) => (d === dayIndex ? null : d)), 1800);
  };

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Day links
        </h3>
        <span className="text-xs text-muted-foreground">
          {days.filter((d) => d.opened).length} of {days.length} open
        </span>
      </div>
      <p className="mt-1 max-w-prose text-sm text-body-foreground">
        One link per day, for the morning Slack post. Each opens that day
        directly on the member&apos;s own track - a day they have not reached
        yet shows its release date rather than its contents, so posting early
        gives nothing away.
      </p>

      <ul className="mt-3 divide-y divide-border">
        {days.map((day) => (
          <li
            key={day.dayIndex}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                day.opened ? "bg-success" : "bg-muted-foreground/30",
              )}
            />
            <span className="w-10 shrink-0 font-mono text-3xs tabular-nums text-muted-foreground">
              D{day.dayIndex}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {day.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {format(new Date(`${day.date}T00:00:00`), "EEE d MMM")}
            </span>
            <span className="sr-only">
              {day.opened ? "Open" : "Not open yet"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => copy(day.dayIndex)}
              aria-label={`Copy the link to day ${day.dayIndex}`}
            >
              {copiedDay === day.dayIndex ? (
                <CheckIcon aria-hidden />
              ) : (
                <CopyIcon aria-hidden />
              )}
              {copiedDay === day.dayIndex ? "Copied" : "Copy"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
