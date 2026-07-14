import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-md border px-3 py-2 text-sm", {
  variants: {
    variant: {
      destructive: "border-destructive/25 bg-destructive/10 text-destructive",
      warning: "border-warning/25 bg-warning/10 text-warning",
      success: "border-success/25 bg-success/10 text-success",
      info: "border-border bg-muted/40 text-foreground",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

/**
 * Inline banner for form errors, warnings, and confirmations. Replaces the
 * hand-rolled `bg-red-50 border-red-200 text-red-700` blobs scattered
 * through the feature areas - matches their visual weight exactly.
 *
 * `destructive` announces assertively (role="alert"); the rest are polite
 * (role="status").
 */
function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Alert, alertVariants };
