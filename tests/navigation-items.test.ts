import { describe, it, expect } from "vitest";
import {
  ADMIN_NAV_ITEM,
  HACKATHON_NAV_ITEM,
  NAV_ITEMS,
  navItemsFor,
} from "@/lib/navigation";

/**
 * The three nav consumers (sidebar, mobile bar, command palette) all read
 * this one function, so what it returns is the app's navigation. The gated
 * entries are the part worth pinning: a wrong `false` hides somebody's
 * section, and a wrong `true` advertises a door that bounces them.
 */
describe("navItemsFor", () => {
  it("shows only the permanent sections to an ordinary member", () => {
    expect(navItemsFor({ canSeeHackathon: false, canSeeAdmin: false })).toEqual([
      ...NAV_ITEMS,
    ]);
  });

  it("puts the hackathon second, directly under the dashboard", () => {
    // Not at the end with Admin: it is a dated event with a survey that
    // closes, and for the week it is live it outranks the standing sections.
    const items = navItemsFor({ canSeeHackathon: true, canSeeAdmin: false });
    expect(items[0].href).toBe("/");
    expect(items[1]).toBe(HACKATHON_NAV_ITEM);
    expect(items).toHaveLength(NAV_ITEMS.length + 1);
  });

  it("keeps the permanent sections in their documented order around it", () => {
    const items = navItemsFor({ canSeeHackathon: true, canSeeAdmin: true });
    expect(items.filter((i) => NAV_ITEMS.includes(i))).toEqual([...NAV_ITEMS]);
  });

  it("keeps Admin last, after the hackathon", () => {
    const items = navItemsFor({ canSeeHackathon: true, canSeeAdmin: true });
    expect(items.at(-1)).toBe(ADMIN_NAV_ITEM);
    expect(items.indexOf(HACKATHON_NAV_ITEM)).toBeLessThan(
      items.indexOf(ADMIN_NAV_ITEM),
    );
  });

  it("never repeats an href, whichever tabs are on", () => {
    for (const canSeeHackathon of [true, false]) {
      for (const canSeeAdmin of [true, false]) {
        const hrefs = navItemsFor({ canSeeHackathon, canSeeAdmin }).map(
          (i) => i.href,
        );
        expect(new Set(hrefs).size).toBe(hrefs.length);
      }
    }
  });

  it("gives the hackathon a prefix-distinct href, so nothing else lights up", () => {
    for (const item of NAV_ITEMS) {
      expect(HACKATHON_NAV_ITEM.href.startsWith(item.href + "/")).toBe(false);
      expect(item.href.startsWith(HACKATHON_NAV_ITEM.href + "/")).toBe(false);
    }
  });
});
