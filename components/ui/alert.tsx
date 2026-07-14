import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "rounded-md border border-border border-l-2 bg-card px-3 py-2 text-sm text-foreground",
  {
    variants: {
      variant: {
        destructive: "border-l-destructive",
        warning: "border-l-warning",
        success: "border-l-success",
        info: "border-l-muted-foreground/40",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

/**
 * Inline banner for form errors, warnings, and confirmations. The message
 * stays ink-on-card; the semantic tone lives only in the 2px left accent -
 * hue never washes the surface or the text.
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
