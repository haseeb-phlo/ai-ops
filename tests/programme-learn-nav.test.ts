import { describe, expect, it } from "vitest";
import { isNavActive } from "@/lib/navigation";
import {
  LEARN_SECTIONS,
  LEARN_SECTION_KEYS,
  learnNavSections,
} from "@/lib/programme/learn-nav";

/**
 * The rules that decide what the AI Training section strip lists.
 *
 * Each one mirrors a redirect on the page it points at, so these tests are
 * really asserting "no tab in this nav can bounce you", which is the property
 * that made a shared strip safe to render above every /learn route.
 */
describe("learnNavSections", () => {
  const member = { isAdmin: false, isLead: false };

  it("gives a locked person nothing to navigate to", () => {
    // Nothing reachable, so the layout renders no strip at all and the
    // locked gate page stays what it is meant to be: a closed door.
    expect(learnNavSections({ access: "locked", ...member })).toEqual([]);
  });

  it("withholds the prompt library until the entry gate is done", () => {
    // /learn/gallery redirects to /learn for anyone short of "open", so
    // listing it before then would be a tab that throws you out.
    expect(learnNavSections({ access: "checkin", ...member })).toEqual([
      "programme",
    ]);
    expect(learnNavSections({ access: "open", ...member })).toEqual([
      "programme",
      "gallery",
    ]);
  });

  it("lists the lead board only for people who lead somebody", () => {
    expect(
      learnNavSections({ access: "open", isAdmin: false, isLead: true }),
    ).toEqual(["programme", "gallery", "team"]);
  });

  it("gives an admin the library and programme admin regardless of the gate", () => {
    // An admin maintains the content before any cohort of their own exists,
    // and /learn/library and /learn/admin gate on real role alone.
    expect(
      learnNavSections({ access: "locked", isAdmin: true, isLead: false }),
    ).toEqual(["gallery", "library", "admin"]);
  });

  it("orders every section by audience: own training, company, then what you run", () => {
    expect(
      learnNavSections({ access: "open", isAdmin: true, isLead: true }),
    ).toEqual(["programme", "gallery", "team", "library", "admin"]);
  });

  it("never lists a section that is a prefix of another", () => {
    // isNavActive prefix-matches, so overlapping hrefs would light two tabs
    // at once - and /learn itself is excluded for exactly this reason.
    for (const key of LEARN_SECTION_KEYS) {
      const others = LEARN_SECTION_KEYS.filter((k) => k !== key);
      const lit = others.filter((k) =>
        isNavActive(LEARN_SECTIONS[key].href, LEARN_SECTIONS[k].href),
      );
      expect(lit).toEqual([]);
    }
  });

  it("keeps a section lit on its own sub-routes", () => {
    expect(isNavActive("/learn/track/quiz/abc", "/learn/track")).toBe(true);
    expect(isNavActive("/learn/track/score", "/learn/track")).toBe(true);
    // The gate and the join page belong to no section: the strip shows with
    // nothing lit rather than lighting the wrong thing.
    for (const key of LEARN_SECTION_KEYS) {
      expect(isNavActive("/learn", LEARN_SECTIONS[key].href)).toBe(false);
      expect(isNavActive("/learn/join", LEARN_SECTIONS[key].href)).toBe(false);
    }
  });
});
