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
      <p className="max-w-prose text-sm text-muted-foreground">
        Haven&apos;t got a code? The programme runs in cohorts — you&apos;ll be
        invited when yours starts. Everything in{" "}
        <a href="/learn" className="text-primary underline underline-offset-4">
          Learn
        </a>{" "}
        is open to browse in the meantime.
      </p>
    </PageContainer>
  );
}
