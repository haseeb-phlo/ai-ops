import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard "← Back to X" link used at the top of detail pages.
 *
 * Replaces hand-rolled string-arrow patterns (`← All workflows`) with a
 * proper Lucide glyph that animates left-on-hover, hits accessible-tap
 * sizes, and shares typography with the rest of the product. Renders as
 * a small chip-style link in the muted-zinc voice the product uses for
 * page-header navigation.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
      <span className="group-hover:underline">{children}</span>
    </Link>
  );
}

/**
 * Standard "Open X →" link used inline at the end of a row or callout.
 * Mirror of BackLink: arrow nudges right on hover.
 */
export function ForwardLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span className="group-hover:underline">{children}</span>
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
