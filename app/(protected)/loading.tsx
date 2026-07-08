import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-group loading state for every authenticated page. Mirrors
 * PageContainer geometry (max-w-6xl px-6 py-8) with a header-bar skeleton
 * and a few content blocks so navigation always paints something while the
 * server component streams.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}
