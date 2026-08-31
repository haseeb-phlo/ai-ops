/**
 * The Core Programme track definition - the single source of truth for what
 * the 15-day programme contains.
 *
 * `supabase/programme_seed.sql` is GENERATED from this file
 * (`npm run seed:programme`); do not hand-edit the SQL. Keeping one
 * definition means the shape test below and the seeded rows cannot drift.
 *
 * Day numbering: day 0 is the entry gate (the baseline "Your AI Score"
 * check-in). Days 1-15 are working days - day 1 is the cohort's start Monday,
 * day 5 the Friday of week 1, day 15 the Friday of week 3.
 */

export type TrackItemType =
  | "questionnaire_baseline"
  | "video"
  | "use_example"
  | "session"
  | "quiz"
  | "questionnaire_post"
  | "submission_slot";

export type TrackItemSpec = {
  type: TrackItemType;
  title: string;
  description?: string;
  dayIndex: number;
  sortOrder: number;
  /**
   * For `video` / `use_example`: the Learn video title to bind to at seed
   * time. Bound by exact (normalised) title match against `learn_videos`,
   * left null when there's no match, and bindable afterwards in the admin
   * Track-items screen. The track only ever REFERENCES Learn.
   */
  learnVideoTitle?: string;
  config?: Record<string, unknown>;
};

/**
 * The 15 daily topics.
 *
 * Day 1 is "What is AI and how does it work?" - foundations before judgement.
 * Adding it shifted every other topic one day later, and a 15-day programme
 * has no room for sixteen: "Choosing the right tool + measuring time saved"
 * came off the end rather than any topic being reordered out of sequence.
 *
 * The question mark on day 1 is load-bearing. Videos bind by exact
 * (lowercased) title match against `learn_videos`, and the library row is
 * titled "What is AI and how does it work?" - drop the mark and the seed binds
 * null, leaving day 1 reading "coming soon" on the cohort's first morning.
 */
export const DAY_TOPICS: readonly string[] = [
  "What is AI and how does it work?",
  "When to use AI and when not to",
  "CRISPE Framework",
  "Connectors & MCP",
  "Projects",
  "Catching confident wrong answers",
  "Research, Memory & files out",
  "Cowork",
  "Skills",
  "Scheduled Tasks",
  "Reverse Prompting",
  "Artifacts",
  "Design",
  "Dispatch + Plugins",
  "Claude everywhere",
] as const;

/**
 * What day 1's video covers, shown under its title.
 *
 * Prose rather than a list because the card renders a description as a single
 * paragraph - newlines collapse, so a bulleted string would run together into
 * something that reads like a mistake.
 */
const DAY_ONE_VIDEO_DESCRIPTION =
  "Prediction rather than lookup, the context window, training cutoff vs live data, the three failure sources and Time-Back Log setup.";

/** Live sessions land mid-week in each of the three weeks. */
export const SESSION_DAYS = [3, 8, 13] as const;

/**
 * Day 1's task, which is the one exception to the pattern below.
 *
 * Every other day asks you to apply the day's technique to something on your
 * own desk. Day 1 has no technique to apply - it explains how the thing works
 * before asking anyone to use it - and on the cohort's first morning a good
 * number of people do not yet have an account to apply anything in. The
 * welcome post in both cohort channels asks them to sort exactly that out.
 *
 * So day 1 buys the setup the remaining fourteen days assume. Running one real
 * task through it is the part that matters: an account nobody has opened is
 * not setup, it is a licence.
 */
const DAY_ONE_EXERCISE = {
  description:
    "Sign in to Claude with your Phlo email, install the desktop app, then run one real task from this week through it.",
} as const;

/**
 * One quiz at the end of each week. Weeks 1 and 2 are short formative checks;
 * week 3 is the longer summative quiz that gate G4 reads.
 *
 * `passMark` lives in config rather than code so the quiz can be retuned
 * without a deploy - and so G4 never hardcodes "8".
 */
export const QUIZ_SPECS = [
  { dayIndex: 5, title: "Week 1 check", questionCount: 10, passMark: 8, summative: false },
  { dayIndex: 10, title: "Week 2 check", questionCount: 10, passMark: 8, summative: false },
  { dayIndex: 15, title: "Final quiz", questionCount: 10, passMark: 8, summative: true },
  // All three pass at 8/10. The weekly checks gate nothing and allow unlimited
  // retakes, so a consistent bar is simpler to explain than a sliding one, and
  // it keeps "passed a Phlo AI quiz" meaning the same thing all the way
  // through. The final is the one that gates completion via G4.
] as const;

/**
 * Submission slots, deliberately SPREAD across the programme rather than all
 * unlocked on day 1.
 *
 * Originally a RAG consequence rather than a stylistic choice: red was ">=5
 * unlocked items incomplete", so opening all five signed_example slots at once
 * put every member straight into red on their first day. RAG now counts what
 * is LATE instead (see overdue.ts), so the spread is no longer load-bearing
 * for that - but it stands on its own: five examples asked for at once is a
 * backlog, five asked for a week apart is a habit.
 */
export const SUBMISSION_SLOT_SPECS = [
  { kind: "work_sample_pre", dayIndex: 1, title: "Work sample (before)", visibility: "private" },
  { kind: "signed_example", dayIndex: 3, title: "Signed example 1", visibility: "cohort" },
  { kind: "signed_example", dayIndex: 6, title: "Signed example 2", visibility: "cohort" },
  { kind: "signed_example", dayIndex: 9, title: "Signed example 3", visibility: "cohort" },
  { kind: "signed_example", dayIndex: 12, title: "Signed example 4", visibility: "cohort" },
  { kind: "signed_example", dayIndex: 14, title: "Signed example 5", visibility: "cohort" },
  { kind: "capstone", dayIndex: 13, title: "Capstone", visibility: "cohort" },
  { kind: "work_sample_post", dayIndex: 15, title: "Work sample (after)", visibility: "private" },
] as const;

/** Render order within a single day. */
const SORT = {
  video: 0,
  use_example: 1,
  session: 2,
  quiz: 3,
  submission_slot: 4,
  questionnaire_post: 5,
} as const;

export const TRACK_SLUG = "core-programme";
export const TRACK_NAME = "Core Programme";

/**
 * Builds the full ordered item list. Pure - takes no arguments and touches
 * nothing external, so the shape test can assert on it directly.
 */
export function buildTrackItems(): TrackItemSpec[] {
  const items: TrackItemSpec[] = [];

  // Day 0 - the entry gate. Nothing else unlocks until this is submitted.
  items.push({
    type: "questionnaire_baseline",
    title: "Your AI Score - 3-minute check-in",
    description:
      "A quick self-assessment. It sets your starting point and unlocks the programme.",
    dayIndex: 0,
    sortOrder: 0,
  });

  // Days 1-15 - a video plus a worked example for each topic.
  DAY_TOPICS.forEach((topic, i) => {
    const dayIndex = i + 1;
    items.push({
      type: "video",
      title: topic,
      description: dayIndex === 1 ? DAY_ONE_VIDEO_DESCRIPTION : undefined,
      dayIndex,
      sortOrder: SORT.video,
      learnVideoTitle: topic,
    });
    // Deliberately NOT bound to the day's Learn video. A use_example is the
    // "now go do it" half of the day, and binding it to the same video would
    // let one tick on /learn complete both items - which would make G1
    // ("watched everything") satisfiable without doing any of the exercises.
    // Titled just "Task". It used to be `${topic} - try it yourself`, which
    // sat directly under a video already carrying the topic - so every day
    // printed its subject twice and then added four words that said nothing.
    // The card groups items under their day, so the noun alone is unambiguous
    // and the description carries the actual instruction.
    items.push({
      type: "use_example",
      title: "Task",
      description:
        dayIndex === 1
          ? DAY_ONE_EXERCISE.description
          : "Apply the day's technique to something on your own desk.",
      dayIndex,
      sortOrder: SORT.use_example,
    });
  });

  for (const [i, dayIndex] of SESSION_DAYS.entries()) {
    items.push({
      type: "session",
      title: `Live session ${i + 1}`,
      dayIndex,
      sortOrder: SORT.session,
      // Populated per cohort via programme_cohorts.session_dates; two dates
      // there means a dual slot and attending either satisfies the item.
      config: { slots: 2 },
    });
  }

  for (const quiz of QUIZ_SPECS) {
    items.push({
      type: "quiz",
      title: quiz.title,
      dayIndex: quiz.dayIndex,
      sortOrder: SORT.quiz,
      config: {
        pass_mark: quiz.passMark,
        question_count: quiz.questionCount,
        summative: quiz.summative,
        // Left empty here and filled by the seed generator from
        // quiz-content.ts. Keeping the import out of this module means
        // track-spec stays free of dependencies, and the engine reads
        // questions from config_json at run time anyway - so an admin can
        // retune one without a deploy.
        questions: [],
      },
    });
  }

  for (const slot of SUBMISSION_SLOT_SPECS) {
    items.push({
      type: "submission_slot",
      title: slot.title,
      dayIndex: slot.dayIndex,
      sortOrder: SORT.submission_slot,
      config: { kind: slot.kind, visibility: slot.visibility },
    });
  }

  items.push({
    type: "questionnaire_post",
    title: "Your AI Score - see what three weeks did",
    dayIndex: 15,
    sortOrder: SORT.questionnaire_post,
  });

  return items.sort(
    (a, b) => a.dayIndex - b.dayIndex || a.sortOrder - b.sortOrder,
  );
}

/** The quiz whose score gate G4 reads. */
export const SUMMATIVE_QUIZ_DAY = QUIZ_SPECS.find((q) => q.summative)!.dayIndex;
