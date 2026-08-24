import { getSessionUser } from "@/lib/auth";
import { loadAiScore } from "@/lib/programme/ai-score";
import { loadTrackState } from "@/lib/programme/track-data";
import { prefillSourceFor, priorWaveFor } from "@/lib/programme/waves";
import { PageContainer, PageHeader } from "@/components/page-header";
import type { Wave } from "@/lib/programme/questions";
import { ScoreForm } from "./_components/score-form";
import { ResultScreen } from "./_components/result-screen";

export const metadata = { title: "Your AI Score" };

/**
 * "Your AI Score".
 *
 * One route, three states:
 *   ?done=<wave> - the result screen, straight after submitting
 *   already submitted this wave - the result screen
 *   otherwise    - the form
 *
 * Which wave is being collected is decided here, not by the client: the post
 * wave once day 15 has unlocked, the baseline before that.
 */
export default async function AiScorePage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; cohort?: string }>;
}) {
  const { done, cohort } = await searchParams;
  const user = await getSessionUser();
  const [score, track] = await Promise.all([
    loadAiScore(user.email),
    // Which cohort decides whether the POST wave is open yet, so a check-in
    // opened from a preview run has to resolve to the preview.
    loadTrackState(user.id, user.email, cohort ?? null),
  ]);

  const byWave = new Map(score.waves.map((w) => [w.wave, w]));

  // The post wave opens once its day-15 item has unlocked; until then the
  // baseline is what's being collected.
  const postItem = track?.items.find(
    (i) => i.item.type === "questionnaire_post",
  );
  const postOpen = postItem ? postItem.state !== "locked" : false;
  const targetWave: Wave =
    postOpen && !byWave.has("post") ? "post" : "cohort_baseline";

  // Showing a result: either just submitted, or revisiting one already done.
  const showWave: Wave | null =
    done && byWave.has(done as Wave)
      ? (done as Wave)
      : byWave.has(targetWave)
        ? targetWave
        : null;

  if (showWave) {
    const current = byWave.get(showWave)!;
    const priorWave = priorWaveFor(showWave);
    const previous = priorWave ? (byWave.get(priorWave) ?? null) : null;
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="Your AI Score"
          description={
            showWave === "post"
              ? "See what three weeks did to your score"
              : "Where you're starting from."
          }
        />
        <ResultScreen
          current={current}
          previous={previous}
          companyAvg={score.company_avg}
          graduation={showWave === "post"}
        />
      </PageContainer>
    );
  }

  const source = prefillSourceFor(targetWave, score.waves);
  const prefill = source
    ? Object.fromEntries(
        Object.entries(source.answers).map(([qid, a]) => [
          qid,
          { value: a.value },
        ]),
      )
    : null;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Your AI Score"
        description={
          targetWave === "post"
            ? "See what three weeks did to your score"
            : "A quick check-in that sets your starting point."
        }
      />
      <ScoreForm
        cohortId={cohort ?? null}
        wave={targetWave}
        prefill={prefill}
        prefillLabel={source?.waveLabel ?? null}
        estimatedMinutes={source ? 3 : 8}
      />
    </PageContainer>
  );
}
