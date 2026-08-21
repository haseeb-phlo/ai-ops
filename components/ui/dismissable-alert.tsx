"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/alert";

/**
 * Alert banner driven by a URL search param. The dismiss button clears the
 * param via router.replace so the banner doesn't survive refreshes or leak
 * into shared URLs once acknowledged.
 */
export function DismissableAlert({
  param,
  variant = "warning",
  children,
}: {
  param: string;
  variant?: "destructive" | "warning" | "success" | "info";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function dismiss() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Alert variant={variant} className="flex items-start justify-between gap-3">
      <div className="min-w-0">{children}</div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="-m-0.5 shrink-0 rounded p-0.5 outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
      >
        <X className="size-4" aria-hidden />
      </button>
    </Alert>
  );
}
