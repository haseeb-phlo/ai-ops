import { describe, it, expect } from "vitest";
import {
  LINKLESS_TASK_DAYS,
  SCREENSHOT_TASK_DAYS,
  TASK_FILE_KEY,
  TASK_LINK_KEY,
  TASK_LINK_MAX_LENGTH,
  filedTaskEvidenceByItem,
  isPreviewableTaskFile,
  normaliseTaskLink,
  shortenTaskLink,
  taskEvidenceByDay,
  taskEvidenceFrom,
  taskFileFrom,
  taskFileHref,
  taskFileMime,
  taskLinkFrom,
  taskTakesFile,
  taskTakesLink,
} from "@/lib/programme/task-link";
import { G3_REQUIRED_CREDITS } from "@/lib/programme/gates";
import { DAY_TOPICS } from "@/lib/programme/track-spec";

const SCREENSHOT = {
  path: "member-1/item-1/file-1",
  name: "run.png",
  mime: "image/png",
  size: 1024,
};

describe("normaliseTaskLink", () => {
  it("keeps a full https link", () => {
    expect(normaliseTaskLink("https://claude.ai/share/abc123")).toBe(
      "https://claude.ai/share/abc123",
    );
  });

  it("trims what the paste brought with it", () => {
    expect(normaliseTaskLink("  https://claude.ai/share/abc  ")).toBe(
      "https://claude.ai/share/abc",
    );
  });

  it("adds a scheme to a bare host, because address bars hide it", () => {
    expect(normaliseTaskLink("claude.ai/share/abc")).toBe(
      "https://claude.ai/share/abc",
    );
  });

  it("leaves http alone rather than upgrading it", () => {
    // An intranet tool on plain http is a legitimate place for an output to
    // live, and silently rewriting the scheme would break the link.
    expect(normaliseTaskLink("http://wiki.internal/page")).toBe(
      "http://wiki.internal/page",
    );
  });

  it("rejects a scheme that would be dangerous to render as an anchor", () => {
    expect(normaliseTaskLink("javascript:alert(1)")).toBeNull();
    expect(normaliseTaskLink("data:text/html,<script>")).toBeNull();
  });

  it("rejects prose, empty input and anything with a space in it", () => {
    expect(normaliseTaskLink("")).toBeNull();
    expect(normaliseTaskLink("   ")).toBeNull();
    expect(normaliseTaskLink("see my drive folder")).toBeNull();
    expect(normaliseTaskLink("claude.ai/share/a b")).toBeNull();
  });

  it("rejects a hostname with no dot in it", () => {
    expect(normaliseTaskLink("localhost/thing")).toBeNull();
  });

  it("rejects anything past the column's cap", () => {
    const long = `https://claude.ai/share/${"a".repeat(TASK_LINK_MAX_LENGTH)}`;
    expect(normaliseTaskLink(long)).toBeNull();
  });
});

describe("taskLinkFrom", () => {
  it("reads the link out of a progress row's meta_json", () => {
    expect(taskLinkFrom({ [TASK_LINK_KEY]: "https://claude.ai/share/a" })).toBe(
      "https://claude.ai/share/a",
    );
  });

  it("returns null for every shape a meta_json can actually be", () => {
    expect(taskLinkFrom(null)).toBeNull();
    expect(taskLinkFrom({})).toBeNull();
    expect(taskLinkFrom({ make_up: true })).toBeNull();
    expect(taskLinkFrom({ [TASK_LINK_KEY]: "" })).toBeNull();
    expect(taskLinkFrom({ [TASK_LINK_KEY]: 42 })).toBeNull();
    expect(taskLinkFrom("not an object")).toBeNull();
  });
});

describe("shortenTaskLink", () => {
  it("drops the scheme so the row reads as a link, not a URL", () => {
    expect(shortenTaskLink("https://claude.ai/share/abc")).toBe(
      "claude.ai/share/abc",
    );
  });

  it("keeps both ends of a long link, so two are distinguishable", () => {
    const short = shortenTaskLink(
      `https://claude.ai/share/${"x".repeat(80)}tail`,
    );
    expect(short.length).toBeLessThanOrEqual(45);
    expect(short).toContain("claude.ai");
    expect(short).toContain("tail");
  });
});

describe("taskEvidenceByDay", () => {
  const taskItems = [
    { id: "d1", day_index: 1 },
    { id: "d2", day_index: 2 },
    { id: "d3", day_index: 3 },
  ];

  it("keys a member's filed evidence by the day it belongs to", () => {
    const byDay = taskEvidenceByDay({
      taskItems,
      metaByItemId: new Map<string, unknown>([
        ["d1", { [TASK_LINK_KEY]: "https://claude.ai/share/one" }],
        ["d3", { [TASK_LINK_KEY]: "https://claude.ai/share/three" }],
      ]),
    });
    expect(byDay).toEqual({
      1: { kind: "link", href: "https://claude.ai/share/one" },
      3: { kind: "link", href: "https://claude.ai/share/three" },
    });
  });

  it("leaves a day out rather than filling it with an empty string", () => {
    // The admin table reads a missing day as "chase this person", so a blank
    // that looks like a link would hide exactly the thing it exists to show.
    const byDay = taskEvidenceByDay({
      taskItems,
      metaByItemId: new Map<string, unknown>([
        ["d1", {}],
        ["d2", { [TASK_LINK_KEY]: "" }],
        ["d3", null],
      ]),
    });
    expect(byDay).toEqual({});
  });

  it("ignores progress rows for items that are not Tasks", () => {
    const byDay = taskEvidenceByDay({
      taskItems,
      metaByItemId: new Map<string, unknown>([
        ["video-1", { [TASK_LINK_KEY]: "https://claude.ai/share/nope" }],
      ]),
    });
    expect(byDay).toEqual({});
  });
});

describe("taskTakesLink", () => {
  it("takes a link on every day except the listed ones", () => {
    for (let day = 1; day <= 15; day += 1) {
      expect(taskTakesLink(day), `day ${day}`).toBe(
        !LINKLESS_TASK_DAYS.has(day),
      );
    }
  });

  it("excludes day 5, whose work is settings rather than output", () => {
    expect(taskTakesLink(5)).toBe(false);
    expect(taskTakesLink(4)).toBe(true);
    expect(taskTakesLink(6)).toBe(true);
  });

  it("leaves enough linkable days to clear the Shared gate", () => {
    // The list costs G3 ceiling, not requirement - but empty enough of the
    // fifteen days out and the gate stops being reachable from Task links
    // alone, which is what the whole currency rests on. Guarded here because
    // adding a day to the set is a one-line change nowhere near gates.ts.
    const linkable = 15 - LINKLESS_TASK_DAYS.size;
    expect(linkable).toBeGreaterThanOrEqual(G3_REQUIRED_CREDITS);
  });

  it("still reads a link that was filed before a day joined the set", () => {
    // Nothing revokes it: the row stays in meta_json and keeps its credit.
    // Only the display and the admin column go. See LINKLESS_TASK_DAYS.
    const byDay = taskEvidenceByDay({
      taskItems: [{ id: "d5", day_index: 5 }],
      metaByItemId: new Map<string, unknown>([
        ["d5", { [TASK_LINK_KEY]: "https://claude.ai/share/old" }],
      ]),
    });
    expect(byDay).toEqual({
      5: { kind: "link", href: "https://claude.ai/share/old" },
    });
  });
});

describe("taskFileFrom", () => {
  it("reads a filed screenshot out of meta_json", () => {
    expect(taskFileFrom({ [TASK_FILE_KEY]: SCREENSHOT })).toEqual(SCREENSHOT);
  });

  it("needs a path and nothing else - the rest has a fallback", () => {
    // The descriptor is a JSON bag written by an action that has changed
    // shape once already. A half-written one has to degrade to a usable row
    // rather than to an <img> with no src on somebody's completed day.
    expect(taskFileFrom({ [TASK_FILE_KEY]: { path: "a/b/c" } })).toEqual({
      path: "a/b/c",
      name: "Screenshot",
      mime: "",
      size: 0,
    });
  });

  it("returns null for every shape a meta_json can actually be", () => {
    expect(taskFileFrom(null)).toBeNull();
    expect(taskFileFrom({})).toBeNull();
    expect(taskFileFrom({ [TASK_FILE_KEY]: null })).toBeNull();
    expect(taskFileFrom({ [TASK_FILE_KEY]: "a/b/c" })).toBeNull();
    expect(taskFileFrom({ [TASK_FILE_KEY]: { path: "" } })).toBeNull();
    expect(taskFileFrom({ [TASK_FILE_KEY]: { name: "run.png" } })).toBeNull();
  });
});

describe("taskEvidenceFrom", () => {
  it("reads either shape out of the one slot", () => {
    expect(
      taskEvidenceFrom({ [TASK_LINK_KEY]: "https://claude.ai/share/a" }),
    ).toEqual({ kind: "link", href: "https://claude.ai/share/a" });
    expect(taskEvidenceFrom({ [TASK_FILE_KEY]: SCREENSHOT })).toEqual({
      kind: "file",
      file: SCREENSHOT,
    });
    expect(taskEvidenceFrom({})).toBeNull();
  });

  it("prefers the link when a row somehow holds both", () => {
    // Each write clears the other, so this should not happen. If it ever
    // does, the thing that opens beats the thing that does not.
    expect(
      taskEvidenceFrom({
        [TASK_LINK_KEY]: "https://claude.ai/share/a",
        [TASK_FILE_KEY]: SCREENSHOT,
      }),
    ).toEqual({ kind: "link", href: "https://claude.ai/share/a" });
  });
});

describe("filedTaskEvidenceByItem", () => {
  const taskItemIds = new Set(["t1", "t2", "t3"]);

  it("counts a screenshot exactly as it counts a link", () => {
    // This map IS the G3 credit count. A day filed with a picture that did
    // not count would leave a member who did every task unable to finish,
    // which is the failure this whole field was added to fix.
    const byItem = filedTaskEvidenceByItem({
      taskItemIds,
      metaByItemId: new Map<string, unknown>([
        ["t1", { [TASK_LINK_KEY]: "https://claude.ai/share/a" }],
        ["t2", { [TASK_FILE_KEY]: SCREENSHOT }],
      ]),
    });
    expect(byItem.size).toBe(2);
    expect(byItem.get("t2")).toEqual({ kind: "file", file: SCREENSHOT });
  });

  it("counts a day once even when both keys are set", () => {
    const byItem = filedTaskEvidenceByItem({
      taskItemIds,
      metaByItemId: new Map<string, unknown>([
        [
          "t1",
          {
            [TASK_LINK_KEY]: "https://claude.ai/share/a",
            [TASK_FILE_KEY]: SCREENSHOT,
          },
        ],
      ]),
    });
    expect(byItem.size).toBe(1);
  });

  it("ignores meta on items that are not Tasks", () => {
    const byItem = filedTaskEvidenceByItem({
      taskItemIds,
      metaByItemId: new Map<string, unknown>([
        ["video-1", { [TASK_FILE_KEY]: SCREENSHOT }],
      ]),
    });
    expect(byItem.size).toBe(0);
  });
});

describe("taskFileMime", () => {
  it("takes the types the bucket takes", () => {
    expect(taskFileMime({ name: "a.png", type: "image/png" })).toBe("image/png");
    expect(taskFileMime({ name: "a.heic", type: "image/heic" })).toBe(
      "image/heic",
    );
  });

  it("refuses a declared type the bucket would reject anyway", () => {
    expect(taskFileMime({ name: "run.pdf", type: "application/pdf" })).toBeNull();
    // Renaming it does not help: the declared type is never overridden.
    expect(taskFileMime({ name: "run.png", type: "application/pdf" })).toBeNull();
  });

  it("falls back to the extension only when the browser declared nothing", () => {
    // Which happens on some file managers, and would otherwise fail exactly
    // the member who screenshotted on their phone.
    expect(taskFileMime({ name: "IMG_0042.HEIC", type: "" })).toBe("image/heic");
    expect(taskFileMime({ name: "shot.JPG", type: "" })).toBe("image/jpeg");
    expect(taskFileMime({ name: "notes.txt", type: "" })).toBeNull();
    expect(taskFileMime({ name: "noextension", type: "" })).toBeNull();
  });
});

describe("serving a filed screenshot", () => {
  it("points at the app route rather than at storage", () => {
    // The bucket is private, so a stored URL would be a signed one that dies
    // a minute later. The path is what is stored; the route signs on demand.
    expect(taskFileHref(SCREENSHOT)).toBe(
      "/learn/track/evidence/member-1/item-1/file-1",
    );
  });

  it("previews what browsers render and only links the rest", () => {
    expect(isPreviewableTaskFile(SCREENSHOT)).toBe(true);
    expect(isPreviewableTaskFile({ ...SCREENSHOT, mime: "image/heic" })).toBe(
      false,
    );
    expect(isPreviewableTaskFile({ ...SCREENSHOT, mime: "" })).toBe(false);
  });
});

describe("taskTakesFile", () => {
  it("offers the upload on days 7 and 14 and nowhere else", () => {
    for (let day = 1; day <= 15; day += 1) {
      expect(taskTakesFile(day), `day ${day}`).toBe(day === 7 || day === 14);
    }
  });

  it("is a strict subset of the days that take a link", () => {
    // A day cannot offer the fallback without offering the thing it falls
    // back from: the link keeps top billing on day 7, and a screenshot-only
    // day would be a shape no surface renders.
    for (const day of SCREENSHOT_TASK_DAYS) {
      expect(taskTakesLink(day), `day ${day}`).toBe(true);
      expect(LINKLESS_TASK_DAYS.has(day), `day ${day}`).toBe(false);
    }
  });

  it("names the days whose work has no link to share", () => {
    // Day 7 is Scheduled Tasks: a scheduled task has runs and no Share link,
    // which is the entire reason the upload exists. Day 14 is the Outlook
    // plugin: a message has no address a colleague can open, and the M365
    // add-ins keep their chat in the browser rather than in a Claude account.
    // If the topic order moves, these are the assertions that should fail
    // rather than the button quietly sitting on the wrong day - so they pin
    // the topics, not just the numbers.
    expect(DAY_TOPICS[6]).toBe("Scheduled Tasks");
    expect(DAY_TOPICS[13]).toBe("Outlook plugin");
    expect([...SCREENSHOT_TASK_DAYS].sort((a, b) => a - b)).toEqual([7, 14]);
  });

  it("still reads a screenshot filed before the day lost the upload", () => {
    // Same precedent as LINKLESS_TASK_DAYS: nothing is revoked. A member who
    // uploaded on day 3 while the button was everywhere keeps the evidence
    // and its G3 credit; only the button to file a new one goes.
    const byDay = taskEvidenceByDay({
      taskItems: [{ id: "d3", day_index: 3 }],
      metaByItemId: new Map<string, unknown>([
        [
          "d3",
          {
            [TASK_FILE_KEY]: {
              path: "m/d3/abc",
              name: "run.png",
              mime: "image/png",
              size: 1234,
            },
          },
        ],
      ]),
    });
    expect(byDay[3]?.kind).toBe("file");
  });
});
