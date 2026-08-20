import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { loadLeadBoard } from "@/lib/programme/lead-board";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PROGRAMME_RAG } from "@/lib/status";
import { cn } from "@/lib/utils";
import { SignOffCard } from "./_components/signoff-card";

export const metadata = { title: "Your team's programme" };

/**
 * The team lead's board.
 *
 * There is no "team lead" role - a lead is anyone named as team_lead_user_id
 * on a cohort member. So this page is reachable by everyone and simply shows
 * an empty state to people who lead nobody, rather than 403-ing.
 */
export default async function LeadsPage() {
  const user = await getSessionUser();
  const board = await loadLeadBoard(user.id);

  if (!board.isLead) {
    return (
      <PageContainer>
        <PageHeader
          title="Your team's programme"
          description="Progress and sign-offs for the people you lead."
        />
        <EmptyState
          icon={<UsersIcon aria-hidden />}
          title="Nobody's assigned to you"
          description="When someone on the Core Programme has you as their team lead, their progress and the work waiting on your sign-off will appear here."
          action={
            <Link
              href="/learn"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Go to Learn
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const needAttention = board.members.filter(
    (m) => m.rag === "red" || m.rag === "amber",
  ).length;

  return (
    <PageContainer>
      <PageHeader
        title="Your team's programme"
        description={
          board.pending.length > 0
            ? `${board.pending.length} waiting on you${needAttention > 0 ? ` · ${needAttention} behind` : ""}`
            : needAttention > 0
              ? `${needAttention} of your team need a nudge`
              : "Everyone's on track."
        }
        actions={
          <Link
            href="/learn/gallery"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Prompt library
          </Link>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Waiting on you
        </h2>
        {board.pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing to sign off right now.
          </p>
        ) : (
          <div className="space-y-3">
            {board.pending.map((p) => (
              <SignOffCard
                key={p.id}
                item={{
                  id: p.id,
                  memberName: p.memberName,
                  kind: p.kind,
                  title: p.title,
                  promptText: p.promptText,
                  taskSolved: p.taskSolved,
                  timeSaved: p.timeSaved,
                  artefactUrl: p.artefactUrl,
                  previousComment: p.previousComment,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Your team
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {board.members.map((m) => {
            const style = m.rag ? PROGRAMME_RAG[m.rag] : null;
            return (
              <li
                key={m.cohortMemberId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="inline-flex items-center gap-2 text-sm text-foreground">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      style?.dotClassName ?? "bg-muted-foreground/30",
                    )}
                  />
                  {m.displayName}
                  {m.completedAt && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                      Completed
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {style?.label ?? "Not yet assessed"}
                  {m.pendingCount > 0 && ` · ${m.pendingCount} awaiting you`}
                  {" · "}
                  {m.cohortName}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </PageContainer>
  );
}
