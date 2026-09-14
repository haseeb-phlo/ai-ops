import type { ElementType } from "react";

import { cn } from "@/lib/utils";

/**
 * The 11px uppercase label that titles a section, a chip or a definition term.
 *
 * It exists because the treatment had drifted into nine variants: three weights
 * (400/500/600) crossed with three trackings (`tracking-wide`, `tracking-wider`
 * and an arbitrary `tracking-[0.06em]`), which is what a rule that lives only in
 * prose turns into. The settled values are weight 500 and `--tracking-eyebrow`.
 *
 * The tracking is *positive* while every heading above it tracks negative. That
 * inversion is the point: an eyebrow is taxonomy rather than a small headline,
 * and the opposite direction is what marks it as a different kind of text
 * instead of a quieter one.
 *
 * `mono` switches to the mono face for IDs, codes and timestamps. It is not the
 * default - two thirds of the app's eyebrows are set in the body face, and
 * making mono the default would silently reclassify them.
 */
export function Eyebrow({
  as: Tag = "span",
  mono = false,
  className,
  children,
  ...props
}: {
  as?: ElementType;
  mono?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag
      className={cn(
        "text-3xs font-medium uppercase tracking-eyebrow text-muted-foreground",
        mono && "font-mono",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
