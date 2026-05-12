import { BackLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/utils";

/**
 * Sticky strip that pins to the top of a detail page so the back link and
 * a compact title stay visible while users scroll through long content
 * (intervention / workflow / champion-team pages).
 *
 * The title here is the small in-strip echo, not the big H1 on the page -
 * the H1 keeps its full hero treatment in the body. When the user scrolls
 * far enough that the H1 is off-screen, this strip carries the context.
 */
export function DetailHeader({
  backHref,
  backLabel,
  title,
  className,
}: {
  backHref: string;
  backLabel: string;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-6 mb-6 flex items-center gap-2 border-b border-border bg-background/95 px-6 py-2.5 backdrop-blur",
        className,
      )}
    >
      <BackLink href={backHref}>{backLabel}</BackLink>
      {title && (
        <>
          <span aria-hidden className="text-muted-foreground/60">/</span>
          <p className="min-w-0 truncate text-sm text-muted-foreground">{title}</p>
        </>
      )}
    </div>
  );
}
