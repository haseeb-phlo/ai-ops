import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AwardIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { loadTrackState } from "@/lib/programme/track-data";
import { canViewCertificate } from "@/lib/programme/completion";
import { GATE_DESCRIPTION, GATE_IDS, GATE_LABEL } from "@/lib/programme/gates";
import { PageContainer } from "@/components/page-header";

export const metadata = { title: "Certificate" };

/**
 * The certificate.
 *
 * Gated on the completion STAMP, not on the live gates - see completion.ts.
 * Someone who has earned it keeps it even if an admin later corrects an
 * attendance mark.
 */
export default async function CertificatePage() {
  const user = await getSessionUser();
  const state = await loadTrackState(user.id, user.email);

  if (!state || !canViewCertificate(state.membership.certificateIssuedAt)) {
    redirect("/learn/track");
  }

  // Dated by when the work was finished, not by when an admin got round to
  // approving it - the achievement is the member's, not the reviewer's.
  const completedOn = format(
    new Date(state.membership.completedAt ?? state.membership.certificateIssuedAt!),
    "d MMMM yyyy",
  );

  return (
    <PageContainer className="max-w-2xl">
      <div className="rounded-lg border border-border bg-background p-8 text-center sm:p-12">
        <span
          aria-hidden
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <AwardIcon className="size-6" />
        </span>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Phlo AI Core Programme
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {user.displayName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          completed the 15-day Core Programme with {state.cohort.name}
          <br />
          on {completedOn}
        </p>

        <ul className="mx-auto mt-8 max-w-sm space-y-2 text-left">
          {GATE_IDS.map((id) => (
            <li
              key={id}
              className="flex items-start gap-2 border-t border-border pt-2 text-sm"
            >
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
              />
              <span>
                <span className="font-medium text-foreground">
                  {GATE_LABEL[id]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {GATE_DESCRIPTION[id]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <Link
          href="/learn/track"
          className="text-muted-foreground hover:text-foreground"
        >
          Back to the programme
        </Link>
        <Link
          href="/learn/gallery"
          className="text-muted-foreground hover:text-foreground"
        >
          See the prompt library
        </Link>
      </div>
    </PageContainer>
  );
}
