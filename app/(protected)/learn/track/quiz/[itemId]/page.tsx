import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTrackState } from "@/lib/programme/track-data";
import { bestScore, hasPassed, parseQuizConfig } from "@/lib/programme/quiz";
import { weekOf } from "@/lib/programme/working-days";
import { PageContainer, PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/ui/nav-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardCheckIcon } from "lucide-react";
import { QuizRunner } from "./_components/quiz-runner";

export const metadata = { title: "Knowledge check" };

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { itemId } = await params;
  // Carried from the track page, so an admin taking the quiz inside their
  // preview run is marked against the preview and not against the real cohort
  // this loader would otherwise prefer.
  const { cohort: cohortParam } = await searchParams;
  const user = await getSessionUser();
  const state = await loadTrackState(user.id, user.email, cohortParam ?? null);
  if (!state) redirect("/learn/track");

  const resolved = state.items.find((r) => r.item.id === itemId);
  if (!resolved || resolved.item.type !== "quiz") notFound();

  // Locked means the day hasn't arrived. Sending them back to the timeline is
  // more useful than a 404 that doesn't say when it opens.
  if (resolved.state === "locked") redirect("/learn/track");

  const config = parseQuizConfig(resolved.item.config_json);
  if (!config) {
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader title={resolved.item.title} />
        <EmptyState
          icon={<ClipboardCheckIcon aria-hidden />}
          title="This quiz isn't ready yet"
          description="The questions are still being written. It'll appear here shortly - nothing else on your track is waiting on it."
          action={
            <Link
              href="/learn/track"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Back to the programme
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const supabase = await createClient();
  const { data: attempts } = await supabase
    .from("programme_quiz_attempts")
    .select("score")
    .eq("cohort_member_id", state.membership.id)
    .eq("track_item_id", itemId)
    .returns<{ score: number }[]>();

  const scores = (attempts ?? []).map((a) => a.score);

  return (
    <PageContainer className="max-w-3xl">
      {/* The section strip hides itself on a quiz (isFocusedLearnRoute), so
          this is the way out of an attempt and it has to be here: without it
          the only exit is the sidebar, and somebody who opened the wrong day
          is stuck on a form they did not want. One link, not a strip - it
          scrolls away as you answer, and QuizRunner offers it again once the
          attempt is marked. */}
      <BackLink href="/learn/track">Back to the programme</BackLink>
      {/* Each quiz names the content it covers rather than "the week just
          gone", which told a member nothing about what to revise. The week
          comes off the item's own day_index, so a quiz that ever moves day
          carries the right label with it.

          The final quiz is the exception and says so: it sits on day 15, but
          it spirals back over one day from each earlier week, so labelling it
          "Week 3" would be the one description on the track that is untrue.
          It also keeps its gate sentence, because whether a quiz counts
          towards finishing is the thing a member most needs to know. */}
      <PageHeader
        title={resolved.item.title}
        description={
          config.summative
            ? "A check of the content covered in Weeks 1 to 3. Passing this is one half of your last gate."
            : `A quick check of the content covered in Week ${weekOf(resolved.item.day_index)}.`
        }
      />
      {/* Neither the answer key nor the explanations are passed to the
          client: an explanation gives the answer away as surely as the index
          does. Both come back with the marked result. */}
      <QuizRunner
        cohortId={state.cohort.id}
        trackItemId={itemId}
        title={resolved.item.title}
        questions={config.questions.map((q) => ({
          question: q.question,
          options: q.options,
        }))}
        passMark={config.pass_mark}
        previousBest={bestScore(scores)}
        alreadyPassed={hasPassed(scores, config.pass_mark)}
      />
    </PageContainer>
  );
}
