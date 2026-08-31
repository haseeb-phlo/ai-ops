import { getSessionUser } from "@/lib/auth";
import { canManageLibrary, learnAccess } from "@/lib/programme/learn-access";
import { isProgrammeLead } from "@/lib/programme/lead-board";
import { learnNavSections } from "@/lib/programme/learn-nav";
import { loadTrackState } from "@/lib/programme/track-data";
import { LearnNav } from "./_components/learn-nav";

/**
 * Everything under /learn gets the section nav, which is the point of putting
 * it in a layout: the pages used to link each other by hand, so five of the
 * six routes were reachable from some other one but not from the rest, and
 * /learn/leads was reachable from none of them. A page cannot forget to be
 * navigable now.
 *
 * The three questions the strip needs are the same three the pages already
 * ask, and both loaders are `cache()`d, so on every route that also asks
 * (/learn, /learn/track, /learn/gallery, /learn/join, /learn/leads) this costs
 * nothing beyond what the page was already paying. Layout and page render
 * concurrently, so even where it is a genuinely new read it adds DB load, not
 * latency.
 *
 * REAL ROLE, not the effective one, matching canManageLibrary's own rule and
 * every other Learn surface: a super admin viewing as a member is shown the
 * member's gate on the page, so showing them admin tabs above it would be the
 * one place the two disagree. Identity-scoped reads use the effective id, so
 * in user mode the strip describes the person being viewed - which is what
 * makes it a faithful preview.
 */
export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const [track, isLead] = await Promise.all([
    loadTrackState(user.id, user.email),
    isProgrammeLead(user.id),
  ]);

  const sections = learnNavSections({
    access: learnAccess({
      inCohort: track !== null,
      entryGateOpen: track?.entryGateOpen ?? false,
    }),
    isAdmin: canManageLibrary(user.realRole),
    isLead,
  });

  return (
    <>
      {/* No reachable section, no strip: that is the locked gate at /learn,
          where the whole message is that there is nothing here yet. Whether
          ONE reachable section is worth a strip depends on which page you are
          standing on, so LearnNav decides that part - see its docblock. */}
      {sections.length > 0 && <LearnNav sections={sections} />}
      {children}
    </>
  );
}
