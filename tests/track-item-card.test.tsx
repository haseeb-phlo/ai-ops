import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  TrackItemCard,
  type TrackItemView,
} from "@/app/(protected)/learn/track/_components/track-item-card";
import { buildTrackItems } from "@/lib/programme/track-spec";

/**
 * What the Task card renders, which no pure function can be asked.
 *
 * Two things live here and nowhere else: a description with steps in it has to
 * come out as a list rather than one run-on paragraph, and a Task has to offer
 * somewhere to file the link to its output. Both are decisions the component
 * makes from the item it is handed.
 *
 * The action module is mocked because it is `"use server"` - importing it for
 * real drags the Supabase server client into jsdom, and nothing here submits.
 */
vi.mock("@/app/(protected)/learn/track/actions", () => ({
  markTrackItemComplete: vi.fn(),
  markTrackItemStarted: vi.fn(),
  saveTaskOutputLink: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const DAY_TWO_TASK = buildTrackItems().find(
  (i) => i.type === "use_example" && i.dayIndex === 2,
)!;

function task(overrides: Partial<TrackItemView> = {}) {
  const item: TrackItemView = {
    id: "11111111-1111-4111-8111-111111111111",
    type: "use_example",
    title: "Task",
    description: DAY_TWO_TASK.description ?? null,
    state: "available",
    unlockDate: "2026-09-01",
    video: null,
    dayArrived: true,
    ...overrides,
  };
  return render(<TrackItemCard cohortId="c1" item={item} />).container;
}

describe("a Task card's copy", () => {
  it("renders day 2's three choices as list items, not one paragraph", () => {
    const container = task();
    const bullets = [...container.querySelectorAll("li")].map((li) =>
      li.textContent?.trim(),
    );
    expect(bullets).toEqual([
      "one you are confident Claude will do well",
      "one you are confident Claude will not do well",
      "one where you are not sure whether it will produce the correct output",
    ]);
  });

  it("keeps each instruction in its own paragraph", () => {
    const container = task();
    const paragraphs = [...container.querySelectorAll("p")].map((p) =>
      p.textContent?.trim(),
    );
    expect(paragraphs[0]).toBe("Pick three jobs from this week:");
    expect(paragraphs).toContain(
      "Before you open Claude, predict each outcome and rate it Certain, Fairly confident or Guessing.",
    );
  });

  it("still renders a one-line task as a single paragraph", () => {
    const container = task({
      description: "Apply the day's technique to something on your own desk.",
    });
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.querySelector("p")?.textContent).toBe(
      "Apply the day's technique to something on your own desk.",
    );
  });

  it("gives a day still to come nothing but its release date", () => {
    // The drip is the point: a task that has not opened must not leak its
    // instructions, and the copy parser must not become a way round that.
    const container = task({ dayArrived: false, state: "locked" });
    expect(container.textContent).not.toContain("Pick three jobs");
    expect(container.textContent).toContain("Released on");
  });
});

describe("a Task card's output link", () => {
  it("offers somewhere to file the link, marked optional", () => {
    const container = task();
    const input = container.querySelector<HTMLInputElement>(
      'input[name="output_url"]',
    );
    expect(input).not.toBeNull();
    expect(input!.placeholder).toContain("claude.ai/share");
    expect(container.textContent).toContain("(optional)");
  });

  it("labels the button so saving a link is visibly the same as finishing", () => {
    const container = task();
    const labels = [...container.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toContain("Save & mark done");
    expect(labels).toContain("Mark complete");
  });

  it("shows a saved link as a link, with a way to replace it", () => {
    const container = task({
      state: "complete",
      outputUrl: "https://claude.ai/share/abc123",
    });
    const anchor = container.querySelector<HTMLAnchorElement>(
      'a[href="https://claude.ai/share/abc123"]',
    );
    expect(anchor).not.toBeNull();
    expect(anchor!.target).toBe("_blank");
    expect(anchor!.rel).toContain("noopener");
    expect(container.textContent).toContain("Replace");
    // The form collapses once a link is in: one field, not a permanent box.
    expect(container.querySelector('input[name="output_url"]')).toBeNull();
  });

  it("keeps the field's id unique when the same item renders twice", () => {
    // The page shows today twice: once in the focus card, once in the
    // timeline below it. An id derived from the item would collide and the
    // label would point at the wrong field.
    const first = task();
    const second = task();
    const idOf = (c: HTMLElement) =>
      c.querySelector<HTMLInputElement>('input[name="output_url"]')!.id;
    expect(idOf(first)).not.toBe(idOf(second));
    expect(first.querySelector("label")!.getAttribute("for")).toBe(idOf(first));
  });

  it("offers no link field on a video", () => {
    const container = task({ type: "video", title: "When to use AI" });
    expect(container.querySelector('input[name="output_url"]')).toBeNull();
  });

  it("offers no link field on a day that has not opened", () => {
    const container = task({ dayArrived: false, state: "locked" });
    expect(container.querySelector('input[name="output_url"]')).toBeNull();
  });
});
