import { Loader2Icon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const spinnerVariants = cva("shrink-0 animate-spin", {
  variants: {
    size: {
      sm: "size-3",
      default: "size-4",
      lg: "size-6",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

function Spinner({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof Loader2Icon> &
  VariantProps<typeof spinnerVariants>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  )
}

export { Spinner, spinnerVariants }
