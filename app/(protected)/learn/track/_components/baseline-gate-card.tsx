import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The entry gate. Shown until the member has a cohort_baseline response.
 *
 * Copy is fixed by the playbook - "Unlock your training — do your 3-minute
 * check-in" - and the aqua wash is deliberate: this is one of the brand
 * moments the design rules reserve `secondary` for, not a status colour.
 */
export function BaselineGateCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary p-5 text-secondary-foreground">
      <h2 className="text-base font-semibold tracking-tight">
        Unlock your training — do your 3-minute check-in
      </h2>
      <p className="mt-1 max-w-prose text-sm text-secondary-foreground/80">
        {compact
          ? "Your Core Programme is waiting behind a quick self-assessment."
          : "It sets your starting point so you can see how far you've moved by the end. Nothing else on the programme opens until it's done."}
      </p>
      <Link
        href="/learn/track/score"
        className={cn(buttonVariants(), "mt-4")}
      >
        See my AI Score
        <ArrowRightIcon aria-hidden />
      </Link>
    </div>
  );
}
