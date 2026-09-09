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
 * It is back, on day 15, because September 2026 freed a slot: "Catching
 * confident wrong answers" was cut from the curriculum entirely, Skills came
 * forward from day 9 to take day 6, and days 10-15 each moved up one. The
 * verification day was the only one on the track whose video was never shot,
 * so it had run as "coming soon" for every cohort it opened for.
 *
 * What went with it is a gap, and calling it anything softer would be wrong.
 * Checking a confident answer against its source was a day's task, two week
 * two questions and a week three spiral, and what remains of it now is one
 * clause in the Memory task saying Memory does not make anything more
 * accurate, and one day 15 question that counts checking time against a
 * claimed saving. That is a thread, not a lesson. The material was cut
 * because the day had no video rather than because the habit stopped
 * mattering, so if it is wanted back the cheapest home is a line in the
 * Research and Memory task, which already has the member reading sources,
 * rather than a sixteenth day the programme has no room for. That task is on
 * day 9 since the 7/9 swap below, so this note names the topic rather than
 * the day number: it has moved once already.
 *
 * Putting the measurement day at the end rather than in the freed middle slot
 * is deliberate: it is the one topic that needs the other fourteen to have
 * happened first, because what it asks you to total up is the fortnight.
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
 * The September 2026 reorder is that same one-off, at ten times the size:
 * 20260906234040_drop_verification_day_and_shift_topics.sql re-points every
 * day from 6 to 15. It differs from the day 4/5 swap in one way worth knowing.
 * That migration only ever SET a binding, on the argument that "coming soon"
 * is worse than a stale one. This one also NULLS, because the failure it is
 * cleaning up is different: day 12 is now "Design" over what was Artifacts'
 * binding, and a member who presses play there watches the wrong topic under
 * a heading that looks right. A day admitting it has no video beats a day
 * lying about which one it has.
 *
 * Days 7 and 9 were swapped in September 2026: Scheduled Tasks moved forward
 * to day 7 and "Research, Memory & files out" took day 9. The video went with
 * the topic, which is the whole reason this direction was chosen over cutting
 * a day - Scheduled Tasks has a row in `learn_videos` and Research does not,
 * so the swap moves a real recording onto day 7 and leaves day 9 reading
 * "coming soon", where day 7 read that way before.
 *
 * The cost is an ordering one and it is real: Scheduled Tasks now opens the
 * day BEFORE Cowork, and a scheduled task is a Cowork feature, so day 7's
 * task sends a member into a tool day 8 has not introduced yet. That is a
 * forward reference of exactly the kind the day 4/5 swap was made to remove.
 * It is survivable because the task names the path rather than assuming the
 * tool is familiar - "Open Cowork, click Scheduled in the sidebar" works for
 * someone who has never opened it - and because the tasks are independent by
 * design, so nothing on day 7 depends on day 8 having happened. If the
 * ordering is ever revisited, this is the argument for putting Scheduled
 * Tasks back behind Cowork, and the reason not to is the video binding above.
 *
 * Days 8 and 11 were swapped in September 2026, the day the cohorts reached
 * day 8: Artifacts moved forward to day 8 and Cowork went back to day 11.
 * Same shape as the 7/9 swap and made for the same reason - Artifacts has a
 * row in `learn_videos` and Cowork does not, so the swap puts a real
 * recording on the day people were looking at that morning and leaves day 11
 * reading "coming soon", where day 8 read that way before. The count of
 * recorded days does not change; which day has one does.
 *
 * The cost is the mirror of the gain and it is worth stating plainly: day 11
 * had a video and now does not. That was an acceptable trade only because of
 * WHEN it was made. Day 8 was open and unrecorded for two live cohorts, and
 * day 11 does not unlock for them until the following Monday - so the swap
 * fixed a day that was failing in front of people and created one that has a
 * weekend of notice on it. Made a week later it would have been a straight
 * downgrade, and anyone tempted to swap a recorded day forward again should
 * check that asymmetry still holds before doing it.
 *
 * The ordering cost is smaller than the 7/9 one. Artifacts asks nothing of
 * the days around it, and Cowork on day 11 lands after Scheduled Tasks on day
 * 7 rather than before it - which repairs half of the forward reference the
 * 7/9 swap introduced, since a scheduled task is a Cowork feature and day 7's
 * task sends the member into Cowork's sidebar. It is still a forward
 * reference, just a longer one, and day 7's copy already names the path
 * rather than assuming the tool is familiar.
 *
 * What went with the topic: the entry here, both written tasks in DAY_TASKS
 * (day 8 rewritten into the earlier format, day 11 keeping the later one it
 * was written in) and the `day` tags in quiz-content.ts, where the swap
 * crossed a quiz boundary and cost a question - see the note there. The
 * one-off is 20260909050428_swap_artifacts_and_cowork_days.sql, and it NULLS
 * as well as sets, for the same reason the September reorder did: day 11 over
 * the Artifacts binding is a day playing the wrong video under a heading that
 * looks right.
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
  "Skills",
  "Scheduled Tasks",
  "Artifacts",
  "Research, Memory & files out",
  "Reverse Prompting",
  "Cowork",
  "Design",
  "Dispatch + Plugins",
  "Claude everywhere",
  "Choosing the right tool + measuring time saved",
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
 * Days 6 and 7 are written to the earlier format instead, the one days 2-5
 * use, and day 4 is the template both follow line for line: an imperative
 * opening, the Customize path, a bulleted list of what to give the thing,
 * "Then test it", the good-to-go/sharpen-it pair, then the ask. Day 6 moved
 * into a week one slot when Skills came forward from day 9, and a member
 * reading Monday to Monday meets it directly after day 5 - so it reads as the
 * odd one out if it keeps the reflective opening and the standalone safety
 * paragraph that the later days use.
 *
 * So the format boundary is now days 1-8 on the earlier shape and days 9-15
 * on the later one. It has moved twice: 1-5 against 6-15 first, then 1-7
 * against 8-15 when day 6 came forward, and now one day further because the
 * 8/11 swap brought Artifacts onto day 8 and the day was rewritten to match
 * the seven days a member has just read. It is worth knowing which side a day
 * sits on before rewriting it, because the two shapes want different things:
 * the earlier one puts the settings in bare bullets and the diagnosis in the
 * closing pair, and the later one carries both in prose.
 *
 * The boundary is a reading order rather than a rule about a day number, and
 * that is the thing to preserve if it moves again. What makes a day sit on
 * the earlier shape is that the days immediately before it do; a day rewritten
 * into the earlier format at, say, day 12 would be the odd one out however
 * carefully it was written.
 *
 * The earlier shape has two variants and it is worth knowing which one you
 * are copying. Days 2, 4, 6 and 7 use the full template with bullets and a
 * test pair. Days 5 and 8 use a compressed one: no bullets, a handful of
 * plain imperative lines, the caution as its own line. Reach for the
 * compressed variant when the day has one straightforward thing to do, and
 * the full template when there is a list of inputs to hand over. Day 8's note
 * below records what happens when a day is forced into the wrong one.
 *
 * The failable step survives the format change and gets sharper for it: the
 * fresh chat still has to fire the Skill without being told its name, and the
 * copy now asks for that over a few runs with different wording, which is the
 * difference between a description that fires and one that happened to fire
 * once on the phrasing its author had in mind.
 *
 * The data caution did NOT survive, and this is the note saying so. Earlier
 * versions of this day carried a line keeping the Skill about the method
 * rather than the data, on the grounds that Skills are built to be shared
 * across a team, so a confidential detail written into one travels further
 * than the person who wrote it. The copy here was supplied by the programme
 * owner without it and is used as given. Day 6 is therefore the one day whose
 * tool reaches something shareable and says nothing about what not to put in
 * it - worth knowing before anyone cites the "safety line where the tool
 * touches real data" rule above and finds this day contradicting it.
 *
 * Day 7 is the newest rewrite and the only task on the track that was changed
 * because the product moved rather than because the copy was weak. Scheduled
 * Tasks swapped onto day 7 from day 9, and the copy it displaced could not
 * come with it, because two of its four instructions had stopped being true:
 *
 *   - it said a scheduled task "only runs while your machine is awake and the
 *     desktop app is open", and told the member to pick a time they are
 *     genuinely at their desk. Anthropic moved Cowork's scheduled runs to the
 *     cloud in July 2026, so they now keep their cadence with the machine
 *     asleep and the app shut. The old advice inverted the current behaviour;
 *   - it said to type /schedule in the prompt box. That is the CLI surface.
 *     In Cowork the path is Scheduled in the left sidebar, and from there
 *     either a description Claude drafts the schedule from or a manual setup.
 *
 * The same correction had to reach the two Scheduled Tasks questions in
 * quiz-content.ts, one of which marked the now-true answer as a distractor.
 * A day's task and its quiz question disagreeing is the failure to watch for
 * when a product fact moves under this file.
 *
 * The failable step is the away-run: leave it to run on its own while you are
 * away from your desk. It is a real pass or fail, and what it tests is
 * whether the member built the task on inputs the cloud can reach.
 * Anthropic's own caveat is the trap - "if a scheduled task requires local
 * files or apps, it will only run locally", and a schedule "can't be tied to
 * a folder on your computer" - so a task pointed at a folder passes on demand
 * and silently never fires unattended. That plays directly off day 8, which
 * asks for exactly such a folder: the two days want opposite things from the
 * same member, and saying so is the lesson rather than a contradiction to
 * smooth over.
 *
 * The earlier format is what carries that well, which is why this day is on
 * it. The two tests land as day 6's pair of "Then test it" lines, on demand
 * first and unattended second, and the local-folder trap goes where day 4 and
 * day 6 put their diagnosis: the "if nothing ran" half of the closing pair.
 * In the later format the same fact was a long prose paragraph that stated
 * the failure before the member had met it.
 *
 * Its safety line sits on the approval mode, which is where this tool touches
 * real data, and it stays a standalone sentence rather than a bullet. Every
 * bullet on days 2-6 is a bare noun phrase carrying no reason, so a caution
 * folded into the list would have lost the reason it exists. Day 5 is the
 * precedent for a safety sentence inside this format.
 *
 * Day 8 is Artifacts, and it is the shortest task on the track: five lines,
 * no bullets. It is written to DAY 5's shape rather than day 4's - a plain
 * imperative, a longer middle line carrying the setting and the escalation to
 * Haseeb, a one-line caution, then the ask. Day 5 is the other day on that
 * compressed variant, and the pair of them is now the precedent for it.
 *
 * It got there in two passes and the first one is worth knowing about,
 * because it is the failure mode of writing to a template. Artifacts came
 * forward from day 11 in September 2026, and the copy was first rebuilt on
 * day 4's full template: bullets for what to give the thing, two "Then test
 * it" lines, the good-to-go/sharpen-it pair. Every slot in the template got
 * filled, and filling them is what made it long. It also grew the kind of
 * line that reads well and teaches nothing - "an Artifact is clay rather than
 * stone", "asking on purpose is most of the skill" - because a template with
 * a slot for a diagnosis invites an aphorism when the day has no real one.
 * The instruction to trim it came from the programme owner. If another day
 * ever needs shortening, this is the pattern to look for: prose that survives
 * because the shape wanted something there.
 *
 * THE PLAN TIER IS THE THING TO CHECK BEFORE EDITING THIS DAY. Anthropic's
 * docs describe two different buttons, and which one a member sees depends on
 * the plan:
 *
 *   - Free, Pro and Max get PUBLISH. It makes the Artifact publicly
 *     available, and anyone with the link can view and interact with it
 *     without signing up.
 *   - Team and Enterprise get SHARE. "Only members of your Team or Enterprise
 *     organization" can open it, and "viewers must authenticate with their
 *     Team or Enterprise account". Public link sharing needs an organisation
 *     Owner to enable external sharing first.
 *
 * The first version of this task was written on the Publish behaviour: it
 * said to publish the Artifact, open the link in a browser you are not signed
 * in to, and treated "it asks you to sign in" as the member's own mistake to
 * fix. On a Team or Enterprise plan every member fails that test, and the
 * diagnosis then sends them after a control they do not have. That is the day
 * 7 failure exactly - a task instructing the inverse of the product - and it
 * is why the copy now says "share" throughout and routes the external case to
 * Haseeb rather than to a setting. Written that way it is correct on either
 * plan, which is the property to keep, because nothing in this repo records
 * which one Phlo is on.
 *
 * The failable step survived the trim, and it had to: "share it and have a
 * colleague open the link" is a real pass or fail, where the original later
 * copy's "publish it and put the link where your team will find it" had no
 * way to come back false. A member who saved it and pasted a chat link has
 * done what those words asked.
 *
 * The two other doc-checked facts in the copy: every version is kept, so a
 * change cannot lose the draft before it, and Artifacts needs "Code execution
 * and file creation" on under Settings > Capabilities. The second is written
 * as a diagnosis rather than a first step - "if Claude answers in the chat
 * instead of opening a panel" - because the toggle is documented for the
 * Free, Pro and Max plans and may not be a member's to set on Team or
 * Enterprise. Same reasoning as the share button: say the thing that is true
 * on both.
 *
 * The safety line is the caution kept from the longer version, moved onto
 * sharing rather than publishing. It is where this tool touches real data.
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
 * One is thinner than the rest and known to be. Day 13 is "Dispatch +
 * Plugins" and there is no video script for it, so its task is built on the
 * only grounded material available - the quiz's line that Plugins change what
 * Claude can reach, where prompting only changes how well you ask. The
 * diagnosis is a real lesson and the task teaches it, but nothing in there is
 * specific to Dispatch. Whoever owns that video should add a step.
 *
 * Day 15 is the newest and the only one that asks for a number rather than an
 * artefact. Its failable step is timing one job with the clock rather than
 * estimating it, which is the whole reason the day exists: the programme is
 * measured on time saved, and a total built out of fifteen guesses is not
 * evidence anybody outside the cohort has cause to believe. It also breaks
 * the run of "submit a link to a thing you made" - the link is to the
 * member's own log, so it is the one day where a shared document rather than
 * a Claude URL is the expected answer.
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
    "Pick one thing you explain to Claude repeatedly (e.g. how a report should be laid out, how a summary should be structured, the checks a piece of work has to pass before you send it).",
    "Go to Customize > Skills and build a Skill for it, letting the built-in skill-creator draft it from your description rather than writing it from scratch. Give it:",
    "- a description saying when to use it",
    "- one task only",
    "- the method it should complete the task using",
    "Then test it by starting a fresh chat and asking to complete the task required without naming the skill.",
    "Try over a few runs with different wording.",
    "If the skill fires, then everything is working. If not, the description is likely too vague or ambiguous. Fix this and try again.",
    "Submit the link to the chat where your Skill fired on its own.",
  ].join("\n"),
  7: [
    "Pick one job you do on a rhythm (e.g. the Monday write-up, the morning scan of your inbox and Slack, the weekly numbers somebody always asks you for).",
    "Go to Cowork > Scheduled and set one up, letting Claude draft it from your description rather than filling the form in yourself. Give it:",
    "- the job in plain English, the way you would brief a colleague",
    "- a cadence (hourly, daily, on weekdays or weekly) and a time you will not be at your desk",
    "- the shape the output should come back in",
    "- a name a colleague would understand",
    "Pick the approval mode yourself rather than taking the one offered. An unattended run is the one place that setting matters, because whatever you allow, it will do with nobody watching.",
    "Then test it by running it once on demand from that same page, before you trust the cadence.",
    "Then leave it to run on its own while you are away from your desk.",
    "If something is waiting for you when you get back, everything is working. If nothing ran, the task is reaching for a folder on your computer: a schedule runs on Anthropic's servers rather than on your laptop, so rebuild it on your Connectors and on files saved to your Claude account.",
    "Submit the link to its first completed run.",
  ].join("\n"),
  8: [
    "Pick something you rebuild most weeks - a status update, a meeting-prep sheet, a checklist - and ask Claude to make it as an Artifact you can reuse.",
    "Change it once in plain English rather than keeping the first draft. Every version is kept, so you can go back. If Claude answers in the chat instead of opening a panel, turn on Code execution and file creation in Settings > Capabilities.",
    "Share it and have a colleague open the link. Sharing stays inside Phlo by default, so if it needs to open for someone outside, ask Haseeb rather than working round it.",
    "Made-up numbers only in anything you share, and keep logins and keys out of it.",
    "Submit the link to your Artifact.",
  ].join("\n"),
  9: [
    "Pick something you would normally lose an afternoon to: a comparison, a supplier or market scan, a written summary that means reading several sources first.",
    "Run it with Research rather than a normal chat. It searches, reads and cross-references many sources and then writes the whole thing up, and it runs in the background - so start it and go and do something else.",
    "Then ask for the result as a file rather than as chat text: a document, a spreadsheet or a deck. Reassembling a finished thing out of a chat by hand is the work you are meant to be stopping.",
    "While you are in Settings, turn Memory on and read what it already holds about you. It saves you the re-briefing every time; it does not make anything more accurate, so nothing about the checking habit changes.",
    "Submit the link to the Research chat, or to the file if it lives somewhere shareable.",
  ].join("\n"),
  10: [
    "Find a prompt that is not working - one you have reworded twice and it still comes back the wrong shape.",
    "Stop rewording it. Turn the questioning round instead: ask Claude what it needs from you in order to do this properly, and then answer its questions.",
    "The questions are the point. What it asks about is almost always context you did not realise you were assuming, and that is the real problem rather than your phrasing.",
    "Run the job again with what came out of the interview, and compare it against the version you were stuck on.",
    "Learn the signal while you are here. One poor answer is normal and a follow-up is just conversation. The same wrong shape three times means the misunderstanding is upstream of the wording, and no rewrite will reach it.",
    "Submit the link to the chat where you let it interview you.",
  ].join("\n"),
  11: [
    "Pick a whole task you dread because it is assembly rather than thinking: merging several documents into one summary, reconciling two lists, tidying and renaming a folder, drafting a recurring update out of scattered notes.",
    "Put only the files that task needs into one folder. Scoping it is the safety step, not a tidy-up - Cowork works on your actual computer, so point it at one folder rather than at everything you have.",
    "Open Cowork in the desktop app, give it access to that folder, and hand over the whole goal in one sentence. Do not steer it click by click; the point is that you stop driving.",
    "Watch it work and stop it if it heads somewhere wrong. Then read the deliverable properly before it goes anywhere - it did the assembly, you still own the call.",
    "Nothing confidential or patient-identifiable in that folder unless the use has been approved.",
    "Submit the link to what it produced.",
  ].join("\n"),
  12: [
    "Describe one screen or document you wish already existed: a landing page, a settings screen, a pitch deck, a one-pager that would make an idea look finished.",
    "Make it in Claude Design, then refine it once in plain English rather than taking the first version. A strong first draft that a person then shapes is the whole method.",
    "Export what you end up with - to PowerPoint, or as a prototype link you can send somebody.",
    "Two honest caveats. It is a research preview, so it is rougher than the rest of the tools here and what comes out is a draft rather than a finished brand. And keep confidential designs, patient-facing material and private code out of it.",
    "Submit the link to the design, or to the file you exported.",
  ].join("\n"),
  13: [
    "Find the thing Claude keeps failing at because it cannot reach or cannot do something, rather than because you asked badly.",
    "Learn to tell those two apart, because the diagnosis is where the time goes. 'It misunderstood me' is a prompt problem and better wording fixes it. 'It cannot get to that' is a capability problem and no rewrite will ever reach it.",
    "Then close the gap rather than rewriting the prompt: add the Plugin that gives Claude the thing it was missing, and run the same job again.",
    "Prompting changes how well you use what is already there. Plugins change what is there.",
    "Submit the link to the job you got working.",
  ].join("\n"),
  14: [
    "Think about where you actually spend the day: a spreadsheet, your inbox, Slack, a browser tab, a document. Claude is available inside most of it.",
    "Install it in the one you live in most. Then do the small job you would never normally open Claude for - the two-minute rewrite, the quick summary, the formula you would have looked up.",
    "That is the point of today. The barrier was never capability, it was friction: stopping, switching app, re-explaining the context and pasting the answer back is enough to make anyone skip a small job. Small jobs are where most of the saving quietly adds up.",
    "Submit the link to the thing you did without leaving the tool you were already in.",
  ].join("\n"),
  15: [
    "List the jobs you moved to Claude over the three weeks, with what each one used to take and what it takes now. If you have kept a Time-Back Log this is that list already; if you have not, build it now.",
    "Then time one of them properly rather than estimating it. Pick the job you are claiming the biggest saving on, run it end to end with the clock going, and write the real number down next to your guess.",
    "That step is the point of today. An estimated saving is the one figure nobody outside this programme has any reason to believe, and the gap between your guess and the clock is usually the most useful thing on the page.",
    "Then choose the container for that job, because picking the wrong one is what people still get wrong long after the features are familiar:",
    "- a Chat for a one-off",
    "- a Project when the background is the same every time",
    "- a Skill when it is a method colleagues should reuse",
    "- a Scheduled Task when it runs on a rhythm",
    "- Cowork when it is assembly across your own files",
    "- an Artifact when the output is a thing your team will open again",
    "If the job you have run in an ordinary Chat all fortnight belongs in one of the other five, move it now.",
    "Submit the link to your log.",
  ].join("\n"),
};

/**
 * One quiz at the end of each week. Weeks 1 and 2 are formative; week 3 is
 * the summative one that gate G4 reads.
 *
 * All three are titled "Week N Quiz". They used to be "Week 1 check", "Week 2
 * check" and "Final quiz", which named three different things on one track
 * and left a member guessing whether a check was the same kind of object as a
 * quiz. `summative` still marks the one that counts, and it is the flag every
 * reader keys on rather than the title, so the rename reaches nothing but the
 * words on the card. What carries the finality now is the quiz page's own
 * subtitle, which says the day 15 one is half of the last gate.
 *
 * `passMark` lives in config rather than code so the quiz can be retuned
 * without a deploy - and so G4 never hardcodes "8".
 */
export const QUIZ_SPECS = [
  { dayIndex: 5, title: "Week 1 Quiz", questionCount: 10, passMark: 8, summative: false },
  { dayIndex: 10, title: "Week 2 Quiz", questionCount: 10, passMark: 8, summative: false },
  { dayIndex: 15, title: "Week 3 Quiz", questionCount: 10, passMark: 8, summative: true },
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
