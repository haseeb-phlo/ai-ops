import Link from "next/link";
import { redirect } from "next/navigation";
import { LockIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { learnAccess } from "@/lib/programme/learn-access";
import { formatIsoDate } from "@/lib/programme/working-days";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BaselineGateCard } from "./track/_components/baseline-gate-card";

export const metadata = { title: "AI Training" };

/**
 * The front door to the AI training, and now a gate rather than a library.
 *
 * What used to be here - twelve videos in a topic grid, open to everyone - is
 * at /learn/library and is admin-only. The reasoning lives in
 * lib/programme/learn-access.ts; the short version is that a browsable
 * catalogue sitting beside a fifteen-day programme contradicted it, let people
 * watch day eleven on day one, and made the mandatory check-in optional in
 * practice by offering a second route to the same videos.
 *
 * Three outcomes, and no fourth:
 *   locked  -> you are not in a cohort, so there is nothing here yet
 *   checkin -> do the 3-minute check-in; nothing else opens until it is done
 *   open    -> the track, which decides what today looks like
 */
export default async function LearnPage() {
  const user = await getSessionUser();
  const track = await loadTrackState(user.id, user.email);

  const access = learnAccess({
    inCohort: track !== null,
    entryGateOpen: track?.entryGateOpen ?? false,
  });

  // Past the gate, this page has nothing of its own to say - the track is the
  // training. Redirect rather than reproduce it, so there is one surface that
  // knows what is unlocked today.
  if (access === "open") redirect("/learn/track");

  return (
    <PageContainer>
      <PageHeader
        title="AI Training"
        description="Phlo's 15-day AI programme, run in cohorts."
      />

      {access === "checkin" ? (
        <>
          <BaselineGateCard />
          <p className="max-w-prose text-xs text-muted-foreground">
            {track!.cohort.name} started{" "}
            {formatIsoDate(track!.cohort.startDate, "long")}. Your first day
            opens as soon as the check-in is in.
          </p>
        </>
      ) : (
        <EmptyState
          icon={<LockIcon aria-hidden />}
          title="Your training hasn't opened yet"
          description="The programme runs in cohorts, and everything in it - the videos, the exercises, the live sessions - opens when yours starts. You'll be told when that is."
          action={
            <Link
              href="/learn/join"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              I have a join code
            </Link>
          }
        />
      )}
    </PageContainer>
  );
}
