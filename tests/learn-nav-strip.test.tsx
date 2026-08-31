import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { LearnNav } from "@/app/(protected)/learn/_components/learn-nav";

/**
 * The AI Training strip's own three decisions, which are the ones the pure
 * rules in learn-nav.ts cannot make: they depend on the route the viewer is
 * standing on, so they live in the component and are asserted here.
 *
 * Both mocks are about keeping the test on the component. `usePathname` is
 * the input under test, and `next/link` needs an App Router context this
 * environment has no business mounting - an anchor carries everything being
 * asserted (href, aria-current, label).
 */
const nav = vi.hoisted(() => ({ pathname: "/learn/track" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ALL = ["programme", "gallery", "team", "library", "admin"] as const;

function strip(pathname: string, sections: readonly string[] = ALL) {
  nav.pathname = pathname;
  const { container } = render(
    <LearnNav sections={sections as Parameters<typeof LearnNav>[0]["sections"]} />,
  );
  const el = container.querySelector('nav[aria-label="AI Training"]');
  return {
    present: el !== null,
    tabs: [...(el?.querySelectorAll("a") ?? [])].map((a) => ({
      label: a.textContent,
      current: a.getAttribute("aria-current") === "page",
    })),
  };
}

describe("LearnNav", () => {
  it("marks the section you are in, and only that one", () => {
    const { present, tabs } = strip("/learn/admin");
    expect(present).toBe(true);
    expect(tabs.filter((t) => t.current).map((t) => t.label)).toEqual([
      "Programme admin",
    ]);
    expect(tabs).toHaveLength(5);
  });

  it("stays lit on a section's sub-routes", () => {
    expect(
      strip("/learn/track/score").tabs.find((t) => t.current)?.label,
    ).toBe("Your programme");
  });

  it("disappears for the length of a quiz", () => {
    // Unsaved answers live in QuizRunner, so the quiz gets one deliberate
    // back link instead of five tabs pinned above the form.
    expect(strip("/learn/track/quiz/2f1c8a90").present).toBe(false);
  });

  it("shows a lone section from anywhere but that section", () => {
    // The unenrolled team lead: one reachable surface, so the strip is their
    // only route to it from the gate page...
    expect(strip("/learn", ["team"])).toMatchObject({
      present: true,
      tabs: [{ label: "Your team", current: false }],
    });
    // ...and pointless once they are on it.
    expect(strip("/learn/leads", ["team"]).present).toBe(false);
  });

  it("renders nothing when no section is reachable", () => {
    expect(strip("/learn", []).present).toBe(false);
  });
});
