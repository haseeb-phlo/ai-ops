import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { PageContainer, PageHeader } from "@/components/page-header";
import { JoinForm } from "./_components/join-form";

export const metadata = { title: "Join the Core Programme" };

/**
 * Self-enrolment.
 *
 * Shareable as /learn/join?code=PHLO-C1 so a Slack post can carry the code and
 * people land one click from being enrolled.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const user = await getSessionUser();

  // Already on a cohort: nothing to join.
  const track = await loadTrackState(user.id, user.email);
  if (track) redirect("/learn/track");

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Join the Core Programme"
        description="Phlo's 15-day AI training. Enter the code from your invite."
      />
      <JoinForm prefilled={code ?? null} />
      {/* This paragraph used to promise an open library to browse in the
          meantime. That stopped being true when Learn became a gate: without
          a cohort you get a locked empty state, so the old copy sent people
          to a dead end and made the programme look broken on the one screen
          they had been invited to. Say what is actually true instead. */}
      <p className="max-w-prose text-sm text-body-foreground">
        Haven&apos;t got a code? The programme runs in cohorts, and the
        training opens when yours starts - there is nothing to browse before
        then. You&apos;ll be added to a cohort Slack channel and invited from
        there. If you think you should already be on one, ask whoever invited
        you or message a super-admin in Slack.
      </p>
    </PageContainer>
  );
}
