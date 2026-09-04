import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loadMemberQuizView } from "@/lib/programme/member-quiz";
import { PageContainer, PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/ui/nav-link";
import { MemberQuizDetail } from "./_components/member-quiz-detail";

export const metadata = { title: "Quiz answers" };

/**
 * One member's quiz answers, every attempt.
 *
 * A route rather than an expanding row on the grid: an attempt is ten
 * questions with five options each, so three quizzes and a couple of retakes
 * is more than a table cell can hold, and a URL per member is what makes it
 * linkable into a conversation about somebody's score.
 *
 * Gated on `realRole` to match /learn/admin exactly. Using the effective
 * `role` would let a super admin viewing the app as a member keep the
 * drill-down while the tab that links here disappeared.
 */
export default async function MemberQuizPage({
  params,
}: {
  params: Promise<{ cohortMemberId: string }>;
}) {
  const { cohortMemberId } = await params;
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    redirect("/learn?toast=admin-only");
  }

  const view = await loadMemberQuizView(cohortMemberId);
  if (!view) notFound();

  const attempted = view.quizzes.filter((q) => q.attempts.length > 0).length;
  const passed = view.quizzes.filter((q) => q.passed).length;

  return (
    <PageContainer className="max-w-4xl">
      <BackLink href="/learn/admin?tab=quizzes">Back to quiz results</BackLink>
      <PageHeader
        title={view.member.displayName}
        description={`${view.cohort.name}${view.cohort.isTest ? " (test cohort)" : ""} · ${passed} of ${view.quizzes.length} quizzes passed · ${view.totalAttempts} attempt${view.totalAttempts === 1 ? "" : "s"} across ${attempted} quiz${attempted === 1 ? "" : "zes"}`}
      />
      <MemberQuizDetail quizzes={view.quizzes} />
    </PageContainer>
  );
}
