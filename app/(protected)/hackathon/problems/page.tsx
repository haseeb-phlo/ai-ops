import Link from "next/link";
import { redirect } from "next/navigation";
import { HammerIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { canSeeProblemBank } from "@/lib/hackathon/access";
import { compareByHours } from "@/lib/hackathon/impact";
import { answerValue } from "@/lib/hackathon/questions";
import { loadHackathonState, loadProblemBank } from "@/lib/hackathon/state";
import { ProblemCard } from "../_components/problem-card";

export const metadata = { title: "The problem bank" };

/**
 * Every problem the company has put forward, readable once you have put one
 * forward yourself.
 *
 * The gate is the point of the page, not an obstacle on the way to it. These
 * are thirty-one colleagues' unedited accounts of what they find tedious;
 * read them before answering and you write a better-phrased version of
 * somebody else's, which is exactly the signal the day is trying to collect.
 * So the route re-checks `canSeeProblemBank` and sends anyone who has not
 * answered back to the form - the table's select policy says the same thing
 * independently, so a mistake here empties the list rather than opening it.
 *
 * Ordered biggest first, because that is the order the four get picked in.
 * The sheet's remaining filters (is the system reachable on the day, are
 * there three examples, does more than one person do it) are deliberately
 * NOT applied: they need a conversation with the engineers on Friday
 * afternoon, and a bank that had already dropped rows would hide the
 * problems that conversation is about. Everything those filters read is on
 * the card.
 */
export default async function ProblemBankPage() {
  const user = await getSessionUser();
  const state = await loadHackathonState({
    userId: user.id,
    email: user.email,
    realRole: user.realRole,
    displayName: user.displayName,
  });

  if (state.access === "locked") redirect("/");
  if (!canSeeProblemBank(state.access)) redirect("/hackathon");

  const responses = await loadProblemBank();
  // Biggest first; an unsized response sorts last. Ties break on who
  // answered first, which is the only fair tiebreak available.
  const ranked = [...responses].sort(
    (a, b) =>
      compareByHours(a.hours, b.hours) ||
      a.submittedAt.localeCompare(b.submittedAt),
  );

  const teams = new Set(
    responses.map((r) => r.team).filter((t): t is string => !!t),
  );
  const totalHours = responses.reduce((sum, r) => sum + (r.hours?.hours ?? 0), 0);
  const anyOpenEnded = responses.some((r) => r.hours?.atLeast);
  // Keyed on the response id, not the name: one cohort member has no
  // directory row, so display names fall back to an email local part and are
  // not guaranteed distinct.
  const wants = responses
    .map((r) => ({
      id: r.id,
      name: r.displayName,
      text: answerValue(r.answers, "q11"),
    }))
    .filter((w): w is { id: string; name: string; text: string } => !!w.text);

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="The problem bank"
        description="Everything the company has put forward for Monday, biggest first."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/hackathon" />}
          >
            Your answer
          </Button>
        }
      />

      {responses.length === 0 ? (
        /* Addressed to a super admin, because nobody else can reach this
           state: a member needs a response of their own to open the bank, and
           that response is the row that makes it non-empty. */
        <EmptyState
          icon={<HammerIcon aria-hidden />}
          title="Nothing in the bank yet"
          description="Nobody has answered the survey yet. Problems will appear here as they come in, biggest first."
        />
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Problems logged" value={String(responses.length)} />
            <Tile label="Teams" value={String(teams.size)} />
            <Tile
              label="Hours a week"
              value={`${roundHours(totalHours)}${anyOpenEnded ? "+" : ""}`}
            />
          </dl>

          <p className="text-xs text-muted-foreground">
            Hours are per person, per week, from how often the task happens and
            how long it takes. Anything marked with a plus is a floor - &ldquo;over
            an hour&rdquo; has no top end.
          </p>

          <div className="space-y-4">
            {ranked.map((response) => (
              <ProblemCard
                key={response.id}
                response={response}
                highlight={response.userId === user.id}
              />
            ))}
          </div>

          {wants.length > 0 && (
            <section className="space-y-3">
              <h2 className="border-b border-border pb-2 text-sm font-semibold tracking-tight text-foreground">
                What people want out of Monday
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {wants.map((want) => (
                  <li key={want.id} className="px-4 py-3">
                    <p className="text-sm text-foreground">{want.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {want.name}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </PageContainer>
  );
}

/** One decimal place, and no trailing ".0" on a whole number of hours. */
function roundHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <dt className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-2xl tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
