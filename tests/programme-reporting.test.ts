import { describe, it, expect } from "vitest";
import {
  bandMigration,
  capabilityMix,
  completionTelemetry,
  confidenceShift,
  driftComparison,
  median,
  proportionAtOrAbove,
  returnerTripwireTripped,
  samePeopleDelta,
  RETURNER_TRIPWIRE_SECONDS,
  type ResponseRow,
} from "@/lib/programme/reporting";
import {
  functionForTeam,
  unmappedTeams,
  UNASSIGNED_FUNCTION,
} from "@/lib/programme/functions";
import type { Wave } from "@/lib/programme/questions";

function row(
  email: string,
  wave: Wave,
  scores: number[],
  extra: Partial<ResponseRow> = {},
): ResponseRow {
  const answers: ResponseRow["answers"] = {};
  scores.forEach((s, i) => {
    answers[`q${i + 1}`] = { value: `opt-${s}`, score: s };
  });
  return {
    email,
    wave,
    team: "Technology",
    functionName: "Technology & Data",
    cohortId: "c1",
    cohortName: "Cohort 1",
    answers,
    durationSeconds: null,
    flow: null,
    ...extra,
  };
}

describe("functionForTeam", () => {
  it("rolls teams up into the configured functions", () => {
    expect(functionForTeam("Dispensary")).toBe("Clinical & Patient Ops");
    expect(functionForTeam("Data & Automation")).toBe("Technology & Data");
    expect(functionForTeam("Product Marketing")).toBe("Marketing");
  });

  it("is case and whitespace insensitive", () => {
    expect(functionForTeam("  dispensary ")).toBe("Clinical & Patient Ops");
  });

  it("puts an unknown team somewhere VISIBLE rather than dropping it", () => {
    // A team missing from a report is far harder to notice than one sitting in
    // an obviously wrong bucket.
    expect(functionForTeam("Some New Team")).toBe(UNASSIGNED_FUNCTION);
    expect(functionForTeam(null)).toBe(UNASSIGNED_FUNCTION);
  });

  it("names teams nobody has mapped, so a rename prompts a config edit", () => {
    expect(unmappedTeams(["Dispensary", "Renamed Team", "Finance"])).toEqual([
      "Renamed Team",
    ]);
  });
});

describe("capabilityMix", () => {
  const before = [row("a@x", "cohort_baseline", [0, 0, 0, 0, 0, 0, 0])];
  const after = [row("a@x", "post", [3, 3, 3, 3, 3, 3, 3])];

  it("counts people at each 0-4 level per question", () => {
    const mix = capabilityMix(before, after);
    expect(mix).toHaveLength(7);
    expect(mix[0].before).toEqual([1, 0, 0, 0, 0]);
    expect(mix[0].after).toEqual([0, 0, 0, 1, 0]);
  });

  it("reports totals so the caller can compute an honest proportion", () => {
    // The two waves can have different numbers of respondents, and a bare
    // percentage would hide that.
    const mix = capabilityMix(before, [...after, row("b@x", "post", [4, 4, 4, 4, 4, 4, 4])]);
    expect(mix[0].beforeTotal).toBe(1);
    expect(mix[0].afterTotal).toBe(2);
  });

  it("ignores an unanswered question rather than counting it as zero", () => {
    const mix = capabilityMix([row("a@x", "cohort_baseline", [])], []);
    expect(mix[0].beforeTotal).toBe(0);
    expect(mix[0].before).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("proportionAtOrAbove", () => {
  it("gives the percentage at a level or higher", () => {
    expect(proportionAtOrAbove([5, 5, 5, 5, 0], 2)).toBe(50);
    expect(proportionAtOrAbove([0, 0, 0, 0, 4], 2)).toBe(100);
  });

  it("is zero rather than NaN when nobody answered", () => {
    expect(proportionAtOrAbove([0, 0, 0, 0, 0], 2)).toBe(0);
  });
});

describe("samePeopleDelta", () => {
  it("only counts people present in BOTH waves", () => {
    // Comparing everyone in A against everyone in B confounds the change with
    // who happened to respond - the May wave has 108 people against a cohort
    // of a dozen.
    const before = [
      row("a@x", "cohort_baseline", [1, 1, 1, 1, 1, 1, 1]),
      row("gone@x", "cohort_baseline", [0, 0, 0, 0, 0, 0, 0]),
    ];
    const after = [
      row("a@x", "post", [3, 3, 3, 3, 3, 3, 3]),
      row("new@x", "post", [4, 4, 4, 4, 4, 4, 4]),
    ];
    const result = samePeopleDelta(before, after);
    expect(result.matched).toBe(1);
    expect(result.beforeMean).toBe(1);
    expect(result.afterMean).toBe(3);
    expect(result.delta).toBe(2);
  });

  it("matches on email case-insensitively", () => {
    const result = samePeopleDelta(
      [row("A@X", "cohort_baseline", [1, 1, 1, 1, 1, 1, 1])],
      [row("a@x", "post", [2, 2, 2, 2, 2, 2, 2])],
    );
    expect(result.matched).toBe(1);
  });

  it("splits improved, unchanged and declined", () => {
    const result = samePeopleDelta(
      [
        row("up@x", "cohort_baseline", [1, 1, 1, 1, 1, 1, 1]),
        row("flat@x", "cohort_baseline", [2, 2, 2, 2, 2, 2, 2]),
        row("down@x", "cohort_baseline", [3, 3, 3, 3, 3, 3, 3]),
      ],
      [
        row("up@x", "post", [2, 2, 2, 2, 2, 2, 2]),
        row("flat@x", "post", [2, 2, 2, 2, 2, 2, 2]),
        row("down@x", "post", [1, 1, 1, 1, 1, 1, 1]),
      ],
    );
    expect(result).toMatchObject({ improved: 1, unchanged: 1, declined: 1 });
  });

  it("returns nulls rather than zero when nobody matches", () => {
    const result = samePeopleDelta(
      [row("a@x", "cohort_baseline", [1, 1, 1, 1, 1, 1, 1])],
      [row("b@x", "post", [3, 3, 3, 3, 3, 3, 3])],
    );
    expect(result.matched).toBe(0);
    expect(result.delta).toBeNull();
  });
});

describe("driftComparison", () => {
  // The ROI argument: improvement WITHOUT training, against three weeks WITH.
  const rows = [
    row("a@x", "may_2026", [1, 1, 1, 1, 1, 1, 1]),
    row("a@x", "cohort_baseline", [2, 2, 2, 2, 2, 2, 2]),
    row("a@x", "post", [4, 4, 4, 4, 4, 4, 4]),
  ];

  it("separates organic drift from the programme's effect", () => {
    const drift = driftComparison(rows);
    expect(drift.organic.delta).toBe(1);
    expect(drift.programme.delta).toBe(2);
    expect(drift.difference).toBe(1);
  });

  it("is null rather than zero when a leg has nobody in common", () => {
    // With nobody matched there is no comparison; a zero would read as
    // "the programme made no difference", which is a different claim.
    const drift = driftComparison([
      row("a@x", "cohort_baseline", [2, 2, 2, 2, 2, 2, 2]),
      row("a@x", "post", [4, 4, 4, 4, 4, 4, 4]),
    ]);
    expect(drift.organic.matched).toBe(0);
    expect(drift.difference).toBeNull();
  });

  it("can show the programme underperforming drift, without hiding it", () => {
    const drift = driftComparison([
      row("a@x", "may_2026", [0, 0, 0, 0, 0, 0, 0]),
      row("a@x", "cohort_baseline", [3, 3, 3, 3, 3, 3, 3]),
      row("a@x", "post", [3, 3, 3, 3, 3, 3, 3]),
    ]);
    expect(drift.difference).toBe(-3);
  });
});

describe("confidenceShift", () => {
  const likert = (value: string) =>
    ({
      email: "a@x",
      wave: "post" as Wave,
      team: null,
      functionName: "x",
      cohortId: null,
      cohortName: null,
      answers: { q9: { value } },
      durationSeconds: null,
      flow: null,
    }) satisfies ResponseRow;

  it("scores Likert answers 0-4 by position", () => {
    const shift = confidenceShift(
      [likert("Strongly Disagree")],
      [likert("Strongly Agree")],
    );
    expect(shift[0]).toMatchObject({ beforeMean: 0, afterMean: 4, delta: 4 });
  });

  it("covers q9 to q15", () => {
    expect(confidenceShift([], [])).toHaveLength(7);
  });

  it("returns null rather than zero for an unanswered question", () => {
    expect(confidenceShift([], [])[0].delta).toBeNull();
  });
});

describe("bandMigration", () => {
  const withBand = (band: string, wave: Wave): ResponseRow => ({
    ...row("a@x", wave, []),
    answers: { q19b: { value: band } },
  });

  it("counts each band in both waves", () => {
    const migration = bandMigration(
      [withBand("1-3", "cohort_baseline")],
      [withBand("5-10", "post")],
    );
    expect(migration.find((m) => m.band === "1-3")).toEqual({
      band: "1-3",
      before: 1,
      after: 0,
    });
    expect(migration.find((m) => m.band === "5-10")?.after).toBe(1);
  });

  it("reports \"can't estimate\" as its own row", () => {
    // Half the May respondents could not put a number on their saving, and
    // that count shrinking is itself an outcome.
    const migration = bandMigration([withBand("can't estimate", "cohort_baseline")], []);
    expect(migration.find((m) => m.band === "can't estimate")?.before).toBe(1);
  });
});

describe("completion telemetry", () => {
  const timed = (flow: "returner" | "first_timer", seconds: number) => ({
    ...row("a@x", "cohort_baseline", []),
    flow,
    durationSeconds: seconds,
  });

  it("takes the median, not the mean, so one slow session cannot skew it", () => {
    expect(median([10, 20, 30, 40, 5000])).toBe(30);
  });

  it("averages the middle two on an even count", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("is null with nothing recorded", () => {
    expect(median([])).toBeNull();
  });

  it("splits by flow", () => {
    const telemetry = completionTelemetry([
      timed("returner", 40),
      timed("returner", 60),
      timed("first_timer", 400),
    ]);
    expect(telemetry.find((t) => t.flow === "returner")).toMatchObject({
      responses: 2,
      medianSeconds: 50,
    });
    expect(telemetry.find((t) => t.flow === "first_timer")?.medianSeconds).toBe(400);
  });

  it("trips when the returner median passes six minutes", () => {
    // The returner flow exists to make an unchanged submission take under a
    // minute. Six means the pre-fill has stopped working, and the next wave's
    // response rate will fall before anyone works out why.
    expect(
      returnerTripwireTripped(
        completionTelemetry([timed("returner", RETURNER_TRIPWIRE_SECONDS + 1)]),
      ),
    ).toBe(true);
  });

  it("does not trip on a slow first-timer, who is expected to take longer", () => {
    expect(
      returnerTripwireTripped(completionTelemetry([timed("first_timer", 1800)])),
    ).toBe(false);
  });

  it("does not trip with no data", () => {
    expect(returnerTripwireTripped(completionTelemetry([]))).toBe(false);
  });
});
