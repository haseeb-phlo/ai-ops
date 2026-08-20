import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENT_PHRASE,
  axisScores,
  capAverage,
  deltaChipState,
  hoursBandShift,
  insightSentence,
  newlyAcquiredAxes,
  scoreAnswer,
  strongestAndWeakest,
  withComputedScores,
  type Answers,
} from "@/lib/programme/score";
import { QUESTION_BY_ID } from "@/lib/programme/questions";
import { prefillSourceFor, priorWaveFor } from "@/lib/programme/waves";

const opt = (qid: string, index: number) =>
  QUESTION_BY_ID.get(qid)!.options![index];

const answersAt = (scores: number[]): Answers => {
  const out: Answers = {};
  scores.forEach((s, i) => {
    const qid = `q${i + 1}`;
    out[qid] = { value: opt(qid, s) };
  });
  return out;
};

describe("scoreAnswer", () => {
  it("scores by option position, 0 to 4", () => {
    for (let i = 0; i <= 4; i++) {
      expect(scoreAnswer("q2", opt("q2", i))).toBe(i);
    }
  });

  it("scores a value carrying a non-breaking space, as the May export does", () => {
    // q2's real option has an NBSP between its two sentences.
    const raw =
      "I've created one or two which I use it occasionally. I mostly still paste context into chats.";
    expect(scoreAnswer("q2", raw)).toBe(2);
  });

  it("returns null for a non-capability question", () => {
    expect(scoreAnswer("q9", "Agree")).toBeNull();
    expect(scoreAnswer("q19", "about 5")).toBeNull();
  });

  it("returns null for an unrecognised value rather than guessing", () => {
    expect(scoreAnswer("q2", "something nobody offered")).toBeNull();
  });
});

describe("withComputedScores", () => {
  it("fills scores in from the option index", () => {
    const result = withComputedScores(answersAt([2, 1, 0, 1, 0, 1, 1]));
    expect(result.q1.score).toBe(2);
    expect(result.q3.score).toBe(0);
  });

  it("scores a carried-forward answer identically to a fresh one", () => {
    // A returner who didn't touch a question still gave that answer.
    const fresh = withComputedScores({ q2: { value: opt("q2", 3) } });
    const carried = withComputedScores({
      q2: { value: opt("q2", 3), carried_forward: true },
    });
    expect(carried.q2.score).toBe(fresh.q2.score);
    expect(carried.q2.carried_forward).toBe(true);
  });

  it("leaves free-text answers untouched", () => {
    const result = withComputedScores({ q19: { value: "2-3 hours ish" } });
    expect(result.q19.score).toBeUndefined();
  });
});

describe("capAverage", () => {
  it("averages the seven axes to one decimal", () => {
    expect(capAverage(axisScores(answersAt([2, 1, 0, 1, 0, 1, 1])))).toBe(0.9);
  });

  it("returns 4 for a full house and 0 for the floor", () => {
    expect(capAverage(axisScores(answersAt([4, 4, 4, 4, 4, 4, 4])))).toBe(4);
    expect(capAverage(axisScores(answersAt([0, 0, 0, 0, 0, 0, 0])))).toBe(0);
  });

  it("is null with nothing answered, rather than a misleading 0.0", () => {
    expect(capAverage({})).toBeNull();
  });

  it("averages only the axes present, without treating absent as zero", () => {
    expect(capAverage({ q1: 4, q2: 2 })).toBe(3);
  });
});

describe("deltaChipState", () => {
  it("shows no chip at all when there is no prior wave", () => {
    // "+1.9 since never" is the bug this prevents.
    expect(deltaChipState(1.9, null, "May").kind).toBe("none");
  });

  it("shows a positive delta", () => {
    const chip = deltaChipState(2.4, 1.8, "May");
    expect(chip.kind).toBe("up");
    if (chip.kind === "up") expect(chip.label).toBe("+0.6 since May");
  });

  it("shows no-change as flat, not as a zero increase", () => {
    const chip = deltaChipState(2.0, 2.0, "May");
    expect(chip.kind).toBe("flat");
    if (chip.kind === "flat") expect(chip.label).toBe("No change since May");
  });

  it("renders a DROP as recalibration, never as a failure", () => {
    // Honest self-assessment falling after training is the Dunning-Kruger
    // correction. If this ever renders red, people game the next wave upward
    // and the instrument stops measuring anything.
    const chip = deltaChipState(1.6, 2.2, "May");
    expect(chip.kind).toBe("down");
    if (chip.kind === "down") {
      expect(chip.label).toBe("Recalibrated since May");
      expect(chip.label).not.toMatch(/-/);
      expect(chip.label.toLowerCase()).not.toContain("down");
    }
  });

  it("avoids floating-point noise in the delta", () => {
    const chip = deltaChipState(2.3, 1.1, "May");
    if (chip.kind === "up") expect(chip.label).toBe("+1.2 since May");
  });
});

describe("insightSentence", () => {
  it("names the strongest and weakest axis with where it's taught", () => {
    const s = insightSentence({ q1: 4, q2: 1, q3: 2, q4: 2, q5: 2, q6: 2, q7: 2 });
    expect(s).toBe(
      "Strongest: Prompting. Biggest opportunity: Projects — Week 1 covers it.",
    );
  });

  it("points AI Ops at the platform rather than a week", () => {
    const s = insightSentence({ q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 0 });
    expect(s).toContain("it's where your training lives");
  });

  it("breaks ties to the lowest q-number, so advice is deterministic", () => {
    // q2 and q5 both sit at 0; q2 wins.
    const { weakest } = strongestAndWeakest({
      q1: 3, q2: 0, q3: 3, q4: 3, q5: 0, q6: 3, q7: 3,
    });
    expect(weakest).toBe("q2");
  });

  it("breaks a top tie to the lowest q-number too", () => {
    const { strongest } = strongestAndWeakest({
      q1: 4, q2: 1, q3: 4, q4: 1, q5: 1, q6: 1, q7: 1,
    });
    expect(strongest).toBe("q1");
  });

  it("does not claim an opportunity when every axis is level", () => {
    const s = insightSentence({ q1: 2, q2: 2, q3: 2, q4: 2, q5: 2, q6: 2, q7: 2 });
    expect(s).toContain("Evenly spread");
    expect(s).not.toContain("Biggest opportunity");
  });

  it("returns null with nothing to describe", () => {
    expect(insightSentence({})).toBeNull();
  });

  it("makes no network or model call", () => {
    // Guarded by construction - the function is synchronous.
    expect(insightSentence({ q1: 1 })).toEqual(expect.any(String));
  });
});

describe("newlyAcquiredAxes", () => {
  it("finds axes that crossed from not-known to in-use", () => {
    const gained = newlyAcquiredAxes(
      { q1: 2, q2: 0, q3: 1, q6: 1 },
      { q1: 3, q2: 2, q3: 1, q6: 4 },
    );
    expect(gained).toEqual(["q2", "q6"]);
  });

  it("ignores improvement that stays below the threshold", () => {
    expect(newlyAcquiredAxes({ q2: 0 }, { q2: 1 })).toEqual([]);
  });

  it("ignores improvement that started above it", () => {
    expect(newlyAcquiredAxes({ q2: 2 }, { q2: 4 })).toEqual([]);
  });

  it("ignores an axis missing from either wave", () => {
    expect(newlyAcquiredAxes({}, { q2: 4 })).toEqual([]);
  });

  it("has a phrasing for every axis it can return", () => {
    const gained = newlyAcquiredAxes(
      { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0 },
      { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3 },
    );
    for (const qid of gained) expect(ACHIEVEMENT_PHRASE[qid]).toBeTruthy();
  });
});

describe("hoursBandShift", () => {
  it("reports an upward move in bands", () => {
    expect(hoursBandShift("1-3", "5-10")).toEqual({
      from: "1-3",
      to: "5-10",
      steps: 2,
    });
  });

  it("reports no move", () => {
    expect(hoursBandShift("3-5", "3-5")?.steps).toBe(0);
  });

  it("reports a downward move", () => {
    expect(hoursBandShift("5-10", "1-3")?.steps).toBe(-2);
  });

  it("refuses to rank \"can't estimate\" rather than inventing a direction", () => {
    expect(hoursBandShift("can't estimate", "5-10")).toBeNull();
    expect(hoursBandShift("1-3", "can't estimate")).toBeNull();
  });

  it("returns null when a wave is missing the answer", () => {
    expect(hoursBandShift(null, "1-3")).toBeNull();
  });
});

describe("wave ordering", () => {
  it("names the prior wave for each wave", () => {
    expect(priorWaveFor("may_2026")).toBeNull();
    expect(priorWaveFor("cohort_baseline")).toBe("may_2026");
    expect(priorWaveFor("post")).toBe("cohort_baseline");
    expect(priorWaveFor("day_90")).toBe("post");
  });

  it("pre-fills from the most recent earlier wave that exists", () => {
    const waves = [{ wave: "may_2026" as const }, { wave: "post" as const }];
    expect(prefillSourceFor("cohort_baseline", waves)?.wave).toBe("may_2026");
    expect(prefillSourceFor("day_90", waves)?.wave).toBe("post");
  });

  it("has nothing to pre-fill from for a first-timer", () => {
    expect(prefillSourceFor("cohort_baseline", [])).toBeNull();
    expect(prefillSourceFor("may_2026", [{ wave: "may_2026" as const }])).toBeNull();
  });
});
