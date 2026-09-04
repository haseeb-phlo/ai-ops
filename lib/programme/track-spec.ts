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
 *
 * Days 4 and 5 were swapped in September 2026: Projects now comes first and
 * Connectors & MCP follows it. The v5 playbook ran them the other way round
 * and the programme inherited that, but both videos were shot on the module's
 * own order - the Projects narration signs off with "that's a Connector's
 * job, and it's the next video in this module", which was a forward reference
 * to the day before. Projects also earns its place first: it is the day that
 * asks nothing of your systems, and Connectors is easier to motivate once
 * someone has felt a Project go stale.
 *
 * The swap is a pair, and everything keyed to the TOPIC has to move with it:
 * the entry here, the written task in DAY_TASKS and the `day` tags in
 * quiz-content.ts, which now carry the programme's own day numbers rather
 * than the v5 playbook's. Everything keyed to the DATE stays put - the Friday quiz
 * is still day 5's.
 *
 * The videos re-bind themselves only on a FRESH seed, where learnVideoTitle
 * is derived from this list and both days start null. Against a live track
 * they do not: the seed syncs title and description but its re-bind block
 * only fills nulls, so it would rename day 4 to "Projects" and leave it
 * pointing at the Connectors video. That is what the migration
 * 20260903040544_swap_projects_and_connectors_days.sql exists for. A future
 * reorder of this list needs the same one-off, or two days quietly play each
 * other's video.
 *
 * Day 3 was the standing exception and is no longer: the library row was
 * titled "CRISP Framework", with no E, so no title this day carried would ever
 * have matched it, and the binding had to be made by hand in the admin
 * Track-items screen. The day's video was replaced in September 2026 and the
 * library is down to a single row titled "Prompting", which matches this
 * topic exactly - so a fresh seed of an empty database now binds day 3 like
 * every other day. Left recorded because the failure it caused was invisible:
 * a day that reads "coming soon" for a video that exists.
 */
export const DAY_TOPICS: readonly string[] = [
  "What is AI and how does it work?",
  "When to use AI and when not to",
  "Prompting",
  "Projects",
  "Connectors & MCP",
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
 * What a day's task says when nothing better has been written for it.
 *
 * Held as a named constant rather than inlined so that "how many days are
 * still on the placeholder" is one grep, not fifteen readings.
 */
export const GENERIC_TASK =
  "Apply the day's technique to something on your own desk.";

/**
 * The days whose task is written rather than generic.
 *
 * Day 1 is the setup day. It has no technique to apply - it explains how the
 * thing works before asking anyone to use it - and on the cohort's first
 * morning a good number of people do not yet have an account to apply
 * anything in. So day 1 buys the setup the remaining fourteen days assume, and
 * running one real task through it is the part that matters: an account
 * nobody has opened is not setup, it is a licence.
 *
 * Day 2 is the first task with a shape of its own: a prediction, then the
 * evidence against it. Sorting work into "AI can" and "AI cannot" from the
 * outside is the thing everyone gets wrong in week one - people hand over what
 * they are already comfortable with and never test the boundary - so the task
 * makes them commit to a guess before they can see the answer.
 *
 * Day 3 moves the framework off the prompt and into a Project's instructions,
 * which is where it earns its keep: CRISPE written into one chat's preamble is
 * a thing you retype, and written into a Project it is standing context every
 * chat inside it starts from. It also asks for a Project as the submitted
 * example rather than a chat, so what gets shared is something a colleague can
 * open and use rather than a transcript to read.
 *
 * Day 4 stands on its own, and deliberately: it names the three parts of a
 * Project and asks for all three, rather than picking up the Project day 3
 * left behind. A task that opens "the Project you built on day 3" is a task
 * that fails for everyone who missed day 3, and by the back half of week one
 * that is not a small number. Overlap with day 3 is the cheaper problem.
 *
 * It is the shortest task on the track and short by choice: three things to
 * give the Project, one test, one link. It was cut back to that in September
 * 2026, and what went with the length is worth knowing before anyone trims
 * another day to match. The test used to be
 * a fresh chat inside the Project asked for something it was not built for -
 * a Project that only answers the question it was built around is a saved
 * prompt, and one that holds its voice across a different ask is standing
 * context, which is the whole claim the video makes. That was the day's one
 * step that could fail; "test it and check the output" is a member marking
 * their own work. Gone with it: "anonymised, with nothing confidential in
 * them" on the knowledge files, and a closing paragraph that sent live data
 * to a Connector rather than into a Project's files. Those are the lines to
 * reinstate if the day needs teeth again.
 *
 * It is also the only task that says "below". That is accurate rather than
 * sloppy - TaskOutputLink renders inside the same card, underneath the copy
 * (app/(protected)/learn/track/_components/track-item-card.tsx) - but it is
 * copy that depends on a layout, so a card that ever moves the field breaks
 * this sentence and nothing else will say so.
 *
 * Days 5-15 were written in September 2026 and every day now carries a real
 * task, so GENERIC_TASK is a fallback nothing currently reaches - which
 * tests/programme-track-spec.test.ts asserts, because a day that quietly
 * falls back to it reads as finished without being it.
 *
 * They share a shape, and it is worth keeping when one gets rewritten:
 *
 *   - The work comes off the member's own desk. "Pick the job you repeat",
 *     not a worked example to follow. A task with its own subject teaches the
 *     feature; a task with the member's subject changes their week, and the
 *     programme is measured on time saved rather than on comprehension.
 *   - There is one step that could fail, and it is the point of the day. The
 *     Skill asked for without being named, the answer checked against the
 *     source rather than against Claude. Without it "try the feature" is
 *     self-marking - which is what day 4 now is, and its note above says so.
 *   - The safety line sits where the tool actually touches real data - the
 *     consent screen on a Connector, the scoped folder for Cowork, made-up
 *     numbers in a published Artifact - and nowhere else. A blanket warning
 *     on all fifteen days is a warning nobody reads by day four.
 *   - Every one that has a link field ends by asking for a link. Day 5 is
 *     the exception at both ends: it has no field and makes no ask, because
 *     what it asks for is settings on the member's own account and there is
 *     nothing to paste. LINKLESS_TASK_DAYS in task-link.ts is the list, and
 *     it is what the copy test exempts.
 *
 * That last one is a copy decision, not a mechanism. On the fourteen days
 * that ask, the link stays OPTIONAL in code (see task-link.ts): plenty of
 * real output is a file on a shared drive, and a required field on unlinkable
 * work buys filler links, which are worse than blanks because you can no
 * longer tell which is which. Asking makes filing one the norm and puts the
 * field in front of people; the Task links table on the admin cohort
 * dashboard is what makes a gap visible - which is also why a day with no
 * field is dropped from that table rather than showing a column of blanks.
 *
 * They are also independent of each other, deliberately, all the way through.
 * The day 4 note explains why: a task that opens "the thing you built on day
 * 3" fails outright for anyone who missed day 3.
 *
 * One is thinner than the rest and known to be. Day 14 is "Dispatch +
 * Plugins" and there is no video script for it, so its task is built on the
 * only grounded material available - the quiz's line that Plugins change what
 * Claude can reach, where prompting only changes how well you ask. The
 * diagnosis is a real lesson and the task teaches it, but nothing in there is
 * specific to Dispatch. Whoever owns that video should add a step.
 *
 * FORMATTING: these are plain text, and the card renders them through
 * `parseItemCopy` (lib/programme/item-copy.ts) - one paragraph per line, and a
 * line starting "- " becomes a bullet. No markdown, no blank-line semantics.
 */
const DAY_TASKS: Readonly<Record<number, string>> = {
  1: [
    "Sign in to Claude with your Phlo email, install the desktop app, then run one real task from this week through it.",
    "Submit the link to that task.",
  ].join("\n"),
  2: [
    "Pick three jobs from this week:",
    "- one you are confident Claude will do well",
    "- one you are confident Claude will not do well",
    "- one where you are not sure whether it will produce the correct output",
    "Before you open Claude, predict each outcome and rate it Certain, Fairly confident or Guessing.",
    "Run all three separately, including the one you expect to fail, and compare the output to your predictions.",
    "If something worked that you expected not to, that is something to delegate to Claude immediately. Something that gave an incorrect output is one to be cautious about and double-check.",
    "If Claude did not produce the output you wanted for a specific task, try again. Add more context, add an example document, or split it into two steps, and see whether that helps.",
    "Submit the link to one of these, preferably the one with the output that surprised you the most.",
  ].join("\n"),
  3: [
    "Take a Project you've already built (or build a new one) and use the CRISPE framework in the instructions.",
    "Run a chat here again and check the output.",
    "Submit the Project as an example of one using a framework.",
  ].join("\n"),
  4: [
    "Pick one task you repeat and build a Project for it, giving it:",
    "- custom instructions",
    "- 2-3 knowledge files",
    "- access with anyone else who could use it",
    "Then test it and check the output.",
    "If the output is exactly what you need, it's good to go. If not, the instructions might be missing something - check and add in whatever is required.",
    "Submit the link to the Project below.",
  ].join("\n"),
  // The one day with no link field - see LINKLESS_TASK_DAYS in task-link.ts.
  // What it asks for is settings on the member's own account, so it ends on
  // the tidy-up rather than on a "Submit the link" that nothing could answer.
  5: [
    "Go to Customize > Connectors and enable the tools you use daily.",
    "Click on a specific connector and check the permissions that it allows by default. If you need additional functionality or are unsure what functionality is safe to enable for a specific connector, let Haseeb know.",
    "Disconnect anything you added to have a look at and are not going to use.",
  ].join("\n"),
  6: [
    "Go back to an answer Claude gave you this week that you acted on without checking. Something specific: a figure, a date, a rule, a cut-off time.",
    "Verify it outside the conversation. Open the actual source - the contract, the system, the page, the person who owns it - and compare.",
    "Then go looking for a wrong answer on purpose. Ask about something you know well enough to mark, and count the errors, including the ones that arrived sounding certain.",
    "Two things that are not checking. Asking Claude whether it is sure tests whether the answer is consistent, not whether it is true. And a citation can be entirely real and still not support the sentence it is attached to, so follow one and read it.",
    "Fluency is not accuracy. The output you should trust least is the one that reads best.",
    "Submit the link to the chat you marked.",
  ].join("\n"),
  7: [
    "Pick something you would normally lose an afternoon to: a comparison, a supplier or market scan, a written summary that means reading several sources first.",
    "Run it with Research rather than a normal chat. It searches, reads and cross-references many sources and then writes the whole thing up, and it runs in the background - so start it and go and do something else.",
    "Then ask for the result as a file rather than as chat text: a document, a spreadsheet or a deck. Reassembling a finished thing out of a chat by hand is the work you are meant to be stopping.",
    "While you are in Settings, turn Memory on and read what it already holds about you. It saves you the re-briefing every time; it does not make anything more accurate, so nothing about the checking habit changes.",
    "Submit the link to the Research chat, or to the file if it lives somewhere shareable.",
  ].join("\n"),
  8: [
    "Pick a whole task you dread because it is assembly rather than thinking: merging several documents into one summary, reconciling two lists, tidying and renaming a folder, drafting a recurring update out of scattered notes.",
    "Put only the files that task needs into one folder. Scoping it is the safety step, not a tidy-up - Cowork works on your actual computer, so point it at one folder rather than at everything you have.",
    "Open Cowork in the desktop app, give it access to that folder, and hand over the whole goal in one sentence. Do not steer it click by click; the point is that you stop driving.",
    "Watch it work and stop it if it heads somewhere wrong. Then read the deliverable properly before it goes anywhere - it did the assembly, you still own the call.",
    "Nothing confidential or patient-identifiable in that folder unless the use has been approved.",
    "Submit the link to what it produced.",
  ].join("\n"),
  9: [
    "Think of one thing you explain to Claude again and again: how a report should be laid out, how a summary should be structured, the checks a piece of work has to pass before you will send it.",
    "Write it down as a Skill. Open Customize, then Skills - and let the built-in skill-creator do the drafting, which means describing the task in a chat rather than writing anything from scratch.",
    "Spend your effort on the description, because the description is the trigger. 'Use this when formatting a monthly performance report' fires when it should. 'Helps with reports' never fires at all.",
    "Then prove it. Start a fresh chat, ask for the task, and do not name the Skill. If it did not fire, the description is too vague - sharpen it and go again.",
    "One Skill, one job. And keep it about the method rather than the data: Skills are built to be shared across a team, so nothing confidential or patient-identifiable goes inside one.",
    "Submit the link to the chat where your Skill fired on its own.",
  ].join("\n"),
  10: [
    "Pick one job you do on a rhythm: the Monday write-up, the morning scan of Slack and flagged email, the weekly numbers somebody always asks you for.",
    "Schedule it in Cowork. Type /schedule in the prompt box and describe what you want in plain English, including when it should run and what shape the output should come back in.",
    "Run it once by hand before you trust it. Check the output is what you actually wanted, and fix the prompt now rather than living with a daily version of nearly right.",
    "Pick a time you are genuinely at your desk. A scheduled task only runs while your machine is awake and the desktop app is open - if the laptop is shut at eight, that run waits until you open it.",
    "Give it a name a colleague would understand, because they may well see it.",
    "Submit the link to its first completed run.",
  ].join("\n"),
  11: [
    "Find a prompt that is not working - one you have reworded twice and it still comes back the wrong shape.",
    "Stop rewording it. Turn the questioning round instead: ask Claude what it needs from you in order to do this properly, and then answer its questions.",
    "The questions are the point. What it asks about is almost always context you did not realise you were assuming, and that is the real problem rather than your phrasing.",
    "Run the job again with what came out of the interview, and compare it against the version you were stuck on.",
    "Learn the signal while you are here. One poor answer is normal and a follow-up is just conversation. The same wrong shape three times means the misunderstanding is upstream of the wording, and no rewrite will reach it.",
    "Submit the link to the chat where you let it interview you.",
  ].join("\n"),
  12: [
    "Pick something you rebuild from scratch most weeks: a status update, a meeting-prep sheet, a checklist, a small calculation you redo by hand every time.",
    "Ask for it as an Artifact, in those words: 'make me a one-page X as an Artifact I can reuse', or 'build me a tool that works out Y'. Asking on purpose is most of the skill.",
    "Then change it, because an Artifact is clay rather than stone. Refine it in plain English or edit it directly, and know that every version is kept so you can go back.",
    "Publish it and put the link where your team will find it. That is the part that pays: one person builds it once and everybody uses it, with no account needed to open it.",
    "Made-up numbers only in anything you publish. Publishing changes who can see it, so keep confidential detail, logins and keys out of it entirely.",
    "Submit the published link.",
  ].join("\n"),
  13: [
    "Describe one screen or document you wish already existed: a landing page, a settings screen, a pitch deck, a one-pager that would make an idea look finished.",
    "Make it in Claude Design, then refine it once in plain English rather than taking the first version. A strong first draft that a person then shapes is the whole method.",
    "Export what you end up with - to PowerPoint, or as a prototype link you can send somebody.",
    "Two honest caveats. It is a research preview, so it is rougher than the rest of the tools here and what comes out is a draft rather than a finished brand. And keep confidential designs, patient-facing material and private code out of it.",
    "Submit the link to the design, or to the file you exported.",
  ].join("\n"),
  14: [
    "Find the thing Claude keeps failing at because it cannot reach or cannot do something, rather than because you asked badly.",
    "Learn to tell those two apart, because the diagnosis is where the time goes. 'It misunderstood me' is a prompt problem and better wording fixes it. 'It cannot get to that' is a capability problem and no rewrite will ever reach it.",
    "Then close the gap rather than rewriting the prompt: add the Plugin that gives Claude the thing it was missing, and run the same job again.",
    "Prompting changes how well you use what is already there. Plugins change what is there.",
    "Submit the link to the job you got working.",
  ].join("\n"),
  15: [
    "Think about where you actually spend the day: a spreadsheet, your inbox, Slack, a browser tab, a document. Claude is available inside most of it.",
    "Install it in the one you live in most. Then do the small job you would never normally open Claude for - the two-minute rewrite, the quick summary, the formula you would have looked up.",
    "That is the point of today. The barrier was never capability, it was friction: stopping, switching app, re-explaining the context and pasting the answer back is enough to make anyone skip a small job. Small jobs are where most of the saving quietly adds up.",
    "Submit the link to the thing you did without leaving the tool you were already in.",
  ].join("\n"),
};

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
 * Submission slots: the two work samples and the capstone. Three, on days 1,
 * 13 and 15.
 *
 * THE FIVE "Example N" SLOTS ARE GONE. They sat on days 3, 6, 9, 12 and 14
 * and asked for a signed example of good work - which by then was a second,
 * generic copy of something the member had already filed. Every day's Task
 * carries its own link box (lib/programme/task-link.ts) and every task
 * description that has one ends by asking for the link, so the work arrives
 * fourteen times - day 5 is the one day with nothing to link - attached to
 * the day that asked for it and to the brief it was answering. An
 * Example slot asked for the same artefact again with the day stripped off
 * it, and a member reasonably read the pair as two pieces of work.
 *
 * `signed_example` stays in the programme_submissions CHECK constraint and in
 * every reader that filters on it: the live cohorts submitted against these
 * slots before they were removed, and those rows and the G3 credit they carry
 * are still real. Nothing here deletes them - the seed only inserts and syncs
 * titles - so a cohort mid-flight keeps the five slots it started with, and
 * only a fresh seed produces a track without them. See gates.ts for how G3
 * counts for both populations at once.
 *
 * Their spread across the programme was load-bearing once - red was ">=5
 * unlocked items incomplete", so opening all five on day 1 put every member
 * straight into red - and stopped being so when RAG moved to counting what is
 * LATE (see overdue.ts). Recorded because it is the reason the slots were
 * spread rather than batched, not a reason to bring them back.
 */
export const SUBMISSION_SLOT_SPECS = [
  { kind: "work_sample_pre", dayIndex: 1, title: "Work sample (before)", visibility: "private" },
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
      description: DAY_TASKS[dayIndex] ?? GENERIC_TASK,
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
