"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "@/lib/navigation";
import {
  isFocusedLearnRoute,
  LEARN_SECTIONS,
  type LearnSectionKey,
} from "@/lib/programme/learn-nav";
import { cn } from "@/lib/utils";

/**
 * The AI Training section strip: one row of links to every /learn surface the
 * viewer can reach, rendered by learn/layout.tsx above every page in the
 * section.
 *
 * THREE LEVELS OF NAVIGATION, THREE LOOKS. The sidebar owns the app's
 * sections; this owns the pages inside one of them; the filled pill tabs on
 * /learn/admin (and /suggestions, and /map) own the panels inside one page.
 * So this is an underline strip rather than a SegmentedControl: on the admin
 * page a second pill row would sit directly under the first and read as a
 * sibling of it, when it is its parent.
 *
 * Geometry is the app-banner one (full width of the frame, left-aligned
 * padding) rather than detail-header's container-aligned bleed, because the
 * section's pages are 3xl (join, quiz, score), 6xl (track, gallery, library,
 * leads) and 7xl (admin) wide. A strip aligned to any one of those is visibly
 * misaligned on the others; a strip aligned to the frame reads as chrome on
 * all of them and needed no page's width changed to look right.
 *
 * Sticky at z-30 (page chrome) matches detail-header, and inherits its one
 * flaw: the z-40 impersonation banner also sticks to top-0, so while viewing
 * as someone else and scrolled, this slides under the banner. Left as-is
 * deliberately - the banner "must sit above page chrome and never be
 * covered", the sidebar still navigates, and the alternative is hard-coding
 * the banner's height, which wraps to two lines on a narrow screen.
 */
export function LearnNav({
  sections,
}: {
  sections: readonly LearnSectionKey[];
}) {
  const pathname = usePathname() ?? "";

  // A focused task suppresses the strip whatever the viewer can reach - see
  // isFocusedLearnRoute. This is the only conditional chrome here; everywhere
  // else the strip is present precisely when it has somewhere to send you.
  if (isFocusedLearnRoute(pathname)) return null;

  const elsewhere = sections.filter(
    (key) => !isNavActive(pathname, LEARN_SECTIONS[key].href),
  );

  // A strip whose every tab points at the page you are already on is not a
  // navigation, it is a label. That is the whole test, and it is finer than
  // "more than one section": a team lead who is not enrolled on a cohort
  // themselves can reach exactly one surface, /learn/leads, which the cron
  // email links them to directly. Counting sections would hide their only
  // route to it everywhere; asking "is there anywhere to go from here" gives
  // them the tab on /learn and drops it once they are on the board.
  if (elsewhere.length === 0) return null;

  return (
    <nav
      aria-label="AI Training"
      className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6"
    >
      {/* overflow-x-auto so five tabs scroll rather than wrap on a phone.
          Two consequences, both of which shaped the tab styling below:
          setting one overflow axis computes the other to `auto` too, so
          nothing may hang outside this box - no `-mb-px` pulling the active
          underline over the strip's hairline (it would be clipped, leaving a
          1px indicator), and the focus indicator is an inset-ring rather
          than an outline, which would be cut off the same way. */}
      <div className="flex gap-1 overflow-x-auto">
        {sections.map((key) => {
          const { href, label } = LEARN_SECTIONS[key];
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-2 py-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
