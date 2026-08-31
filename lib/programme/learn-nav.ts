import { isNavActive } from "@/lib/navigation";
import type { LearnAccess } from "./learn-access";

/**
 * The AI Training section's own navigation vocabulary.
 *
 * Six routes live under /learn and, until this module existed, none of them
 * agreed on how to reach the others: the track linked only the prompt
 * library, the library linked only programme admin, admin linked back to the
 * library and the track, the gallery had a "Back to Learn" that redirected
 * straight to the track, and /learn/leads was reachable only from a link in a
 * cron email. So the way back to programme admin was the sidebar's AI
 * Training tab - which redirects to the track, where there was no admin link
 * at all. There was no way round the section, only in and out of it.
 *
 * One strip in learn/layout.tsx now carries all of it, which is why this is a
 * table rather than per-page links: a new route under /learn joins the section
 * nav by being added here, and cannot be half-linked.
 *
 * Sibling of lib/navigation.ts and deliberately separate from it: that module
 * is the app's *primary* vocabulary (sidebar, mobile bar, command palette),
 * this one is the second level inside a single section. Both are plain consts
 * so a client component can import them directly - it has to, because the
 * server layout cannot pass component-valued icons across the boundary.
 */
export const LEARN_SECTION_KEYS = [
  "programme",
  "gallery",
  "team",
  "library",
  "admin",
] as const;

export type LearnSectionKey = (typeof LEARN_SECTION_KEYS)[number];

/**
 * Labels are the page's own H1 wherever one exists, so the tab you click and
 * the heading you land on say the same thing. Hrefs are prefix-distinct on
 * purpose: /learn itself is not a section (it is the gate, and it redirects),
 * so no item can be a prefix of another and isNavActive stays unambiguous -
 * /learn/track/quiz/x keeps "Your programme" lit.
 */
export const LEARN_SECTIONS: Record<
  LearnSectionKey,
  { href: string; label: string }
> = {
  programme: { href: "/learn/track", label: "Your programme" },
  gallery: { href: "/learn/gallery", label: "Prompt library" },
  team: { href: "/learn/leads", label: "Your team" },
  library: { href: "/learn/library", label: "Video library" },
  admin: { href: "/learn/admin", label: "Programme admin" },
};

/**
 * Which sections this viewer can actually reach, in audience order: their own
 * training first, then the company's shared output, then what they run for
 * other people.
 *
 * Every rule here mirrors the guard on the page it points at, because a nav
 * item that bounces you is worse than no nav item. /learn/gallery redirects
 * to /learn unless you are past the entry gate; /learn/library and
 * /learn/admin redirect unless you are a super admin; /learn/track has
 * nothing to show without a cohort; /learn/leads shows an empty board to
 * anyone who leads nobody, and there are 138 people in the org and a handful
 * of leads, so it is listed only for the handful.
 *
 * No reachable section means no strip at all - the layout checks for that,
 * and the one place it happens is the locked gate at /learn, where the whole
 * point is that there is nothing here yet. Whether a *single* reachable
 * section earns a strip is LearnNav's call rather than this module's, because
 * it depends on which route the viewer is standing on.
 */
export function learnNavSections(input: {
  access: LearnAccess;
  /** canManageLibrary(realRole) - real role, as everywhere in Learn. */
  isAdmin: boolean;
  /** Named as a team lead or a cohort's default approver on any live cohort. */
  isLead: boolean;
}): readonly LearnSectionKey[] {
  const visible: Record<LearnSectionKey, boolean> = {
    programme: input.access !== "locked",
    gallery: input.access === "open" || input.isAdmin,
    team: input.isLead,
    library: input.isAdmin,
    admin: input.isAdmin,
  };
  return LEARN_SECTION_KEYS.filter((key) => visible[key]);
}

/**
 * Routes inside the section that hide the strip outright, however many
 * sections the viewer can reach.
 *
 * A quiz attempt is unsaved client state: the answers live in QuizRunner
 * until the form is submitted and nothing guards a navigation away, so a
 * five-tab strip pinned to the top of the page for the length of an attempt
 * is five ways to lose the lot. The quiz asks for one thing and offers one
 * way out instead - a single back link, which scrolls away as you answer and
 * is offered again on the marked result.
 *
 * One entry today. Anything else under /learn that holds unsubmitted work in
 * client state belongs here too.
 */
const FOCUSED_ROUTES = ["/learn/track/quiz"] as const;

export function isFocusedLearnRoute(pathname: string): boolean {
  return FOCUSED_ROUTES.some((route) => isNavActive(pathname, route));
}
