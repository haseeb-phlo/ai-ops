import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2Icon, HammerIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { canSeeProblemBank } from "@/lib/hackathon/access";
import { loadHackathonState } from "@/lib/hackathon/state";
import { loadParticipants } from "@/lib/hackathon/participants";
import { SurveyForm } from "./_components/survey-form";
import { ProblemCard } from "./_components/problem-card";
import { RosterPanel } from "./_components/roster-panel";

export const metadata = { title: "What should we fix on Monday?" };

/**
 * The hackathon problem survey.
 *
 * One route, three states, the shape "Your AI Score" already established:
 *
 *   locked           - not on the guest list. Redirected to the dashboard
 *                      rather than shown a door, because the Hackathon tab is
 *                      not in their nav either and a URL they were not sent
 *                      should not explain what they are missing.
 *   not answered yet - the intro and the form.
 *   answered         - their own answer, the way everyone else will read it,
 *                      plus the way into the bank. `?edit=1` reopens the
 *                      form on it.
 *
 * The intro copy is the build sheet's, verbatim, because it is what was
 * posted in Slack beside the link: the same words on both sides of the click
 * is how somebody knows they are in the right place.
 */
export default async function HackathonPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; edit?: string }>;
}) {
  const { done, edit } = await searchParams;
  const user = await getSessionUser();
  const state = await loadHackathonState({
    userId: user.id,
    email: user.email,
    realRole: user.realRole,
    displayName: user.displayName,
  });

  if (state.access === "locked") redirect("/");

  const bankOpen = canSeeProblemBank(state.access);
  const own = state.own;
  // The guest list, and the only place it can be edited. Loaded for super
  // admins only - everybody else's RLS returns just their own row, so there
  // would be nothing to show and a panel implying otherwise.
  const roster =
    user.realRole === "super_admin" ? await loadParticipants() : null;

  if (!own || edit === "1") {
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="What should we fix on Monday?"
          description={
            own
              ? "Change anything you like. Saving replaces your earlier answer."
              : "Five minutes, eleven questions, nine of them required."
          }
        />
        {!own && (
          <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
            <p>
              On Monday, teams of three plus an engineer will spend the day
              fixing real Phlo problems with AI. We will pick the problems from
              your answers to this form.
            </p>
            <p>
              Think about the small, repetitive parts of your week - copying
              information between systems, chasing the same thing again and
              again, writing the same message with slight changes - not big
              strategy.
            </p>
            <p className="text-muted-foreground">
              Five minutes. Closes Friday at 3pm.
            </p>
          </div>
        )}
        <SurveyForm initial={own?.answers ?? null} submittedAlready={!!own} />
        {roster && <RosterPanel participants={roster} />}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="What should we fix on Monday?"
        description="Your problem is in the bank."
        actions={
          bankOpen ? (
            <Button render={<Link href="/hackathon/problems" />}>
              <HammerIcon aria-hidden />
              See everyone&apos;s problems
            </Button>
          ) : undefined
        }
      />

      {done === "1" && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary p-4 text-sm text-secondary-foreground">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Thanks - that is logged.</p>
            <p className="mt-0.5 text-secondary-foreground/80">
              Everyone in the cohort who has answered can now read it, and you
              can read theirs. If yours is picked you will hear on Friday
              afternoon and pitch it for two minutes at 09:30 on Monday.
            </p>
          </div>
        </div>
      )}

      <ProblemCard response={own} showWants highlight />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" render={<Link href="/hackathon?edit=1" />}>
          Change my answer
        </Button>
        <span className="text-xs text-muted-foreground">
          Submitted <TimeStamp value={own.submittedAt} />
          {own.revised && " (revised)"}
        </span>
      </div>

      {roster && <RosterPanel participants={roster} />}
    </PageContainer>
  );
}

/**
 * Rendered on the server in Europe/London rather than through the shared
 * `<Time>` primitive, which formats in the viewer's locale: everybody
 * reading this is in one office on one deadline, and "Friday 15:00" has to
 * mean the same thing to all of them.
 */
function TimeStamp({ value }: { value: string }) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
  return <time dateTime={value}>{formatted}</time>;
}
