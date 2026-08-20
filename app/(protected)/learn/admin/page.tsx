import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/page-header";
import fixture from "@/lib/programme/may-2026-distribution.json";
import { ImportPanel } from "./_components/import-panel";

export const metadata = { title: "Programme admin" };

/**
 * Programme admin.
 *
 * Lives under /learn rather than as another tab on /admin: the roster,
 * dashboard and reporting surfaces coming in Parts 4 and 7 would double the
 * size of that already-large page, and everything here is programme-specific.
 */
export default async function ProgrammeAdminPage() {
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    redirect("/learn?toast=admin-only");
  }

  const supabase = await createClient();
  const [{ count: mayCount }, { count: unlinkedCount }, { data: cohorts }] =
    await Promise.all([
      supabase
        .from("ai_score_responses")
        .select("id", { count: "exact", head: true })
        .eq("wave", "may_2026"),
      supabase
        .from("ai_score_responses")
        .select("id", { count: "exact", head: true })
        .eq("wave", "may_2026")
        .is("user_id", null),
      supabase
        .from("programme_cohorts")
        .select("id, name, status, start_date, is_test")
        .order("start_date", { ascending: false })
        .returns<
          {
            id: string;
            name: string;
            status: string;
            start_date: string;
            is_test: boolean;
          }[]
        >(),
    ]);

  return (
    <PageContainer>
      <PageHeader
        title="Programme admin"
        description="Cohorts and the AI Score baseline. Roster and reporting land in the next releases."
        actions={
          <Link
            href="/learn/track"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View the member track
          </Link>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Cohorts
        </h2>
        {(cohorts ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No cohorts yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {(cohorts ?? []).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">
                  {c.name}
                  {c.is_test && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      test
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.status} · starts {c.start_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Your AI Score — May 2026 baseline
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {mayCount ?? 0} stored
            {(unlinkedCount ?? 0) > 0 &&
              ` · ${unlinkedCount} awaiting first sign-in`}
          </span>
        </div>
        <ImportPanel
          expected={
            fixture.distributions as Record<string, Record<string, number>>
          }
        />
      </section>
    </PageContainer>
  );
}
