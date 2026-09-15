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
 * The cost is an ordering one and it is real: Scheduled Tasks opens before
 * Cowork, and a scheduled task is a Cowork feature, so day 7's task sends a
 * member into a tool the curriculum has not introduced yet. That is a forward
 * reference of exactly the kind the day 4/5 swap was made to remove. It is
 * survivable because the task names the path rather than assuming the tool is
 * familiar - "Scheduled in the sidebar" works for someone who has never
 * opened it - and because the tasks are independent by design, so nothing on
 * day 7 depends on the Cowork day having happened. The current copy does not
 * name Cowork at all, so for the task the reference is gone entirely. If the
 * ordering is ever revisited, this is the argument for putting Scheduled
 * Tasks back behind Cowork, and the reason not to is the video binding above.
 *
 * That gap has been one day, then four, and is two now: the 8/11 swap below
 * moved Cowork to day 11 and the 9/11 swap after it brought Cowork to day 9.
 * Do not read a distance into this note - it has been wrong twice.
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
 * Days 9 and 11 were swapped immediately after, on the same day: Cowork moved
 * forward to day 9 and "Research, Memory & files out" went back to day 11.
 * This is the one reorder in this file that needed NO migration, and the
 * reason is worth knowing so the omission does not read as an oversight.
 * Neither topic had a row in `learn_videos` at the time, so both days were
 * already null and stayed null: there was nothing for the seed's re-bind to
 * fill and nothing for a one-off to clear. Every other swap here moved a real
 * recording, which is what the migrations exist for.
 *
 * Cowork was recorded on 2026-09-10 and day 9 is bound to it, so the premise
 * of the paragraph above no longer holds - it is history rather than the
 * current state. Day 11 is the unrecorded one of the pair now.
 *
 * It also repays most of the ordering cost the 7/9 swap booked. Day 7 puts a
 * Cowork feature before Cowork has been introduced, and that gap was two days
 * when Cowork sat on day 8, four when it went to day 11, and is two again
 * now. The task itself no longer names Cowork - day 7's rewrite sends the
 * member to "Scheduled in the sidebar" - so what is left of the forward
 * reference is the curriculum's rather than the copy's.
 *
 * What the shorter gap buys is the other pairing, which is a real one. Day 7
 * warns that a schedule tied to a folder on your computer only runs when you
 * are there, and day 9 asks for exactly such a folder. Two days apart that
 * lands as the lesson it is meant to be; a week apart, which is where the
 * 8/11 swap had left it, the two halves are too far apart to read as a pair.
 *
 * The quiz cost nothing this time, unlike the 8/11 swap. Cowork and Research
 * carry two questions each, so the pairs traded places one for one: Cowork's
 * moved from week three to week two and Research's the other way, and both
 * quizzes stayed at ten. A swap across a quiz boundary is only expensive when
 * the two days carry different numbers of questions.
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
/**
 * CLAUDE DESIGN TOOK DAY 10 ON 2026-09-11 and Reverse Prompting went back to
 * day 12, swapping the pair on the programme owner's instruction. The tasks
 * moved with the topics; the quiz questions are in quiz-content.ts and the
 * reasoning for which of them could be rewritten is in that file's header.
 *
 * THE SEED CANNOT FINISH THIS SWAP, which is the part worth knowing. Its
 * re-bind block only fills a null learn_video_id, so it never re-points a day
 * that already has one. Day 10 was BOUND, to the Reverse Prompting recording,
 * so renaming it would have left a day headed "Claude Design" playing Reverse
 * Prompting - the exact failure 20260909050428_swap_artifacts_and_cowork_days
 * exists for, and worse than a missing video because nothing on the page
 * admits it. A migration nulls it. Day 12 was unbound and its new title
 * matches a learn_videos row exactly, so the seed binds that half by itself.
 *
 * DAY 10 NOW HAS ITS VIDEO and the paragraph that stood here - that Claude
 * Design had no recording and the day read "coming soon" - is history rather
 * than the current state. The recording was made and uploaded on 2026-09-11,
 * the same day the swap ran, titled exactly "Claude Design", so it binds by
 * title like every other day. The migration above nulled day 10 that morning
 * and this filled it the same afternoon; both were needed, in that order, and
 * neither is redundant.
 *
 * BINDING IT MAKES DAY 10 REQUIRED, which is the part worth stating. An
 * unbound video day is left out of gate G1 and the RAG sweep by
 * content-readiness.ts, so while day 10 was blank nobody was marked down for
 * it. It now counts, for the two live cohorts, as of today - that is the
 * intended effect of the recording existing, not a side effect to be
 * surprised by.
 *
 * The day was held shut from 07:00 to 09:00 that morning - see DAY_HOLDS in
 * working-days.ts - and unlike day 9 the hold did NOT cover the gap. It
 * expired on its own at 09:00 and the video arrived at 10:34, so day 10 was
 * open reading "coming soon" for about 95 minutes.
 *
 * The day 10 task is day 12's, with one addition: it now says where Claude
 * Design is (claude.ai/design, or the desktop sidebar) and names the Export
 * button rather than assuming the reader will find either. Day 7's note is
 * the precedent - a day that says where a thing lives beats a day that
 * assumes it. Both facts, and the research-preview caveat the copy already
 * carried, were checked against Anthropic's own pages on 2026-09-11.
 */
/**
 * DAYS 11 AND 12 BECAME "CLAUDE DESIGN 2" AND "CLAUDE POWERPOINT" on
 * 2026-09-15, on the programme owner's instruction. "Research, Memory & files
 * out" and "Reverse Prompting" leave the curriculum, so the back half of week
 * three now runs Design, Design again, then PowerPoint.
 *
 * Each topic took its task in DAY_TASKS and its questions in quiz-content.ts
 * with it, the way every reorder before this one did. What is different is
 * that this is a REPLACEMENT rather than a swap: nothing catches the two
 * topics further down the track, and they are gone from the programme.
 *
 * DAY 11 HAS A RECORDING, made the same morning and titled "Claude Design 2",
 * so it binds by title like every other day. It is the wireframes-and
 * -prototypes half of Claude Design rather than a second pass over decks:
 * clickable wireframes from a document you already have, three versions to
 * choose between, and an export - PNG, HTML, or the thing handed to Claude
 * Code to build. The task is written from that recording rather than around
 * it.
 *
 * DAY 12 BRIEFLY BECAME "CLAUDE POWERPOINT" and was replaced again the same
 * morning - see the stanza below. The half of this that stuck is that day 12
 * lost its binding: it pointed at the Reverse Prompting recording, and the
 * seed's re-bind block only fills nulls, so left alone it would have played
 * Reverse Prompting under whatever heading day 12 carried. That is the
 * failure the two September swap migrations exist for, and
 * 20260915053000_day_11_design_2_and_day_12_powerpoint nulls it while stating
 * the whole fifteen-day mapping the way its predecessors do. The null is
 * still the right end state, so the migration is not superseded by the change
 * that followed it - only its title is now out of date.
 *
 * TWO LIVE MEMBERS HAD ALREADY DONE DAY 11, and unlike the 10/12 swap this
 * one cannot say it checked and found none. Day 11 opened for Cohorts 1A and
 * 1B on 2026-09-14 and one member of each completed its Task - the Research
 * one - that afternoon. A rename edits the item in place, so both now hold a
 * completion for a day that asks for something else, with a filed link
 * pointing at a Research chat. Nothing re-locks and neither was asked to do
 * it again; that is the programme owner's call rather than this file's. Day
 * 12 had no live completions - every day 12 progress row belongs to the
 * Rehearsal cohort, which finished in June.
 *
 * WHAT THE DROPPED TOPICS LEAVE. Research and Memory are now taught nowhere
 * on the track: the day 11 task was the only place either was set as work,
 * and its two quiz questions went with it. Reverse Prompting keeps its
 * recording in the Learn library, so it stays watchable at /learn, but it is
 * no longer a day anybody is walked through. This is the second cut in a
 * fortnight - "catching confident wrong answers" was the first - and the same
 * warning applies: what is left of each is a thread, not a lesson.
 */
/**
 * DAYS 12, 13 AND 14 BECAME THE OFFICE EXTENSION RUN later on 2026-09-15, on
 * the programme owner's instruction: PowerPoint and Word, then Excel, then
 * Outlook. "Claude PowerPoint" lasted a few hours and never opened for
 * anybody; "Dispatch + Plugins" and "Claude everywhere" leave the curriculum
 * with it.
 *
 * THEY SHIPPED AS "PLUGINS" AND WERE RENAMED TO "EXTENSIONS" the same
 * evening, before any of the three opened. The programme owner's word is
 * extensions and that is what the three titles and the task copy say. What
 * did NOT change is the line in each task pointing at the Add-ins menu:
 * Microsoft calls them add-ins and Anthropic ships them as Claude for Excel,
 * PowerPoint, Word and Outlook, so a member looking for the word on their own
 * screen needs the word their own screen uses. A day may be titled in the
 * house vocabulary; a step that names a menu may not.
 *
 * DAY 15 IS UNCHANGED AND PENDING. The programme owner is deciding what it
 * becomes, so "Choosing the right tool + measuring time saved" and both its
 * quiz questions stand until they say. A day left alone is not a day nobody
 * has thought about - this sentence is the difference.
 *
 * WHY A RUN RATHER THAN THREE DAYS. The three build on one setting: the
 * add-ins coordinate, so Claude can read an Excel model and write the deck
 * from it, or pull figures out of an Outlook thread into a sheet. That is off
 * by default on our Team plan and an org owner turns it on under
 * Organization settings, Office agents, which is why day 12's task sets it up
 * and the two after it draw on it. Done in the other order the run reads as
 * three unrelated installs.
 *
 * "CLAUDE EVERYWHERE" IS ABSORBED RATHER THAN CUT, which is the honest
 * reading: day 14 used to make the general case that Claude sits inside the
 * tools you already use, and the three days now make it in four of them, with
 * the friction argument intact in day 12's quiz explanation. "Dispatch +
 * Plugins" is a straight loss and should be recorded as one. The distinction
 * it taught - "it misunderstood me" is a prompting problem, "it cannot reach
 * that" is a capability problem, and no rewrite touches the second - is
 * taught nowhere else, and its quiz question went with it. The cheapest home
 * if it is wanted back is a line in day 15's task, wherever day 15 lands.
 *
 * THE COPY WAS CHECKED against Anthropic's own documentation on 2026-09-15,
 * because a task that names a menu is worthless if the menu moved: the
 * add-ins install from Microsoft AppSource and open under Home, Add-ins on
 * Windows or Tools, Add-ins on a Mac; Excel, PowerPoint and Word are
 * generally available and Outlook is a public beta; cross-app work is "Let
 * Claude work across files" per add-in, off by default on Team and
 * Enterprise; and Claude reads and writes only the file that is OPEN, which
 * is the limit every one of the three tasks names.
 *
 * NO MIGRATION THIS TIME. Days 12, 13 and 14 are all unbound today, and none
 * of the three new titles matches a learn_videos row, so the seed's re-bind
 * finds nothing and leaves them null. Three days reading "coming soon" is the
 * state to fix with recordings, not with SQL. A recording must be titled
 * exactly as the topic reads here to bind by itself.
 *
 * DAY 14 NOW OFFERS THE SCREENSHOT UPLOAD, the second day ever to - see
 * SCREENSHOT_TASK_DAYS in task-link.ts. Outlook work has nothing to link: a
 * message has no URL a colleague can open, and the M365 add-ins keep their
 * chat history in the browser rather than in a Claude account, so there is no
 * shareable chat either. That is day 7's argument exactly, which is why the
 * set is now two rather than fourteen.
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
  "Cowork",
  "Claude Design",
  "Claude Design 2",
  "PowerPoint and Word extensions",
  "Excel extension",
  "Outlook extension",
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
 * use. Day 6 follows day 4 line for line: an imperative opening, the
 * Customize path, a bulleted list of what to give the thing, "Then test it",
 * the good-to-go/sharpen-it pair, then the ask. Day 7 follows day 5 instead,
 * which is the same format without the bullets - see its own note below for
 * why that suits it better. Day 6 moved into a week one slot when Skills came
 * forward from day 9, and a member reading Monday to Monday meets it directly
 * after day 5 - so it reads as the odd one out if it keeps the reflective
 * opening and the standalone safety paragraph that the later days use.
 *
 * So the format boundary is now days 1-9 on the earlier shape and days 10-15
 * on the later one. It has moved three times: 1-5 against 6-15 first, then
 * 1-7 against 8-15 when day 6 came forward, then 1-8 when the 8/11 swap
 * brought Artifacts onto day 8, and now 1-9 with day 9's rewrite. Each move
 * is the same argument as the
 * first: a day reads as the odd one out when the days immediately before it
 * are on the other shape, and by day 9 a member has read eight compressed or
 * bulleted days in a row. It is worth knowing which side a day
 * sits on before rewriting it, because the two shapes want different things:
 * the earlier one puts the settings in bare bullets (or plain paragraphs, on
 * the day 5 variant) and the diagnosis in the closing pair, and the later one
 * carries both in prose.
 *
 * The boundary is a reading order rather than a rule about a day number, and
 * that is the thing to preserve if it moves again. What makes a day sit on
 * the earlier shape is that the days immediately before it do; a day rewritten
 * into the earlier format at, say, day 12 would be the odd one out however
 * carefully it was written.
 *
 * The earlier shape has two variants and it is worth knowing which one you
 * are copying. Days 2, 4 and 6 use the full template with bullets and a test
 * pair. Days 5, 7, 8 and 9 use a compressed one: no bullets, a handful of
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
 * and silently never fires unattended. That plays directly off the Cowork
 * day, which asks for exactly such a folder: the two days want opposite
 * things from the same member, and saying so is the lesson rather than a
 * contradiction to smooth over. Cowork is day 9 since the 9/11 swap, two days
 * after this one, which is close enough for the pairing to land as the lesson
 * it is meant to be. It spanned a week while Cowork sat on day 11.
 *
 * It is written to DAY 5's shape rather than day 4's: plain imperative
 * paragraphs, no bullets, and it is the second day on the track to look like
 * that. Day 5 is the right sibling for it because the two days are the same
 * kind of day - you go to a screen and set something up - and neither has a
 * "give it these three things" list that bullets would earn. Day 4's template
 * was tried first and the bullets read as ceremony around four short
 * settings.
 *
 * The length history, because it was cut twice and the second cut was the
 * one asked for: 1199 characters over 11 lines to start, 495 over 8 on day
 * 4's template, 456 over 4 now. Day 5 is 352 over 3, and the difference is
 * roughly the "Submit the link" line, which day 5 is the one day on the track
 * not to carry.
 *
 * THE UI FACTS WERE RE-CHECKED against the help centre in September 2026 and
 * two of them were wrong in the version before this. They are the things to
 * re-check first if this day ever reads oddly, because all of them are
 * screen-shaped and screens move:
 *
 *   - Scheduled is its OWN top-level item in the left sidebar, leading to a
 *     Scheduled tasks page. It is not reached through Cowork, and the copy
 *     said "Cowork > Scheduled" for two revisions. That path was invented by
 *     analogy with day 5's "Customize > Connectors" and never verified;
 *   - the button is New task, top right, offering Create with Claude or Set
 *     up manually. The manual modal asks for a name, a prompt, an approval
 *     mode, a frequency (hourly, daily, weekly, on weekdays or manually) and
 *     optionally a model and a folder;
 *   - a run stalls rather than fails when it needs a tool the approval mode
 *     has not granted, and Anthropic's own fix is to press Run now once and
 *     approve with "always allow", after which later runs stop asking. That
 *     replaced "an approval mode you picked, not the default", which named
 *     the setting without saying what to do about it and taught nothing;
 *   - the folder field exists but choosing one makes the task local-only,
 *     which is the reconciliation of two doc lines that look contradictory:
 *     a schedule "can't be tied to a folder on your computer" and "if a
 *     scheduled task requires local files or apps, it will only run locally";
 *   - scheduled tasks are paid plans only, and web and mobile are still beta.
 *     Not in the copy, because every Phlo member is on a paid seat, but it is
 *     the first thing to check if somebody cannot find the section at all.
 *
 * "Files saved to your Claude account" is back in the closing line, so the
 * day again names both halves of what a schedule can reach rather than only
 * Connectors.
 *
 * One side effect worth knowing: this version does not mention Cowork at all.
 * The forward reference the 7/9 swap created is therefore gone from the copy,
 * though the pairing note above still holds, because the day 9 Cowork task
 * is the one that asks for a scoped folder. It said day 11 for a revision
 * after the 9/11 swap had already moved Cowork.
 *
 * Day 8 is Artifacts, and it is five lines, no bullets. It is written to DAY
 * 5's shape rather than day 4's - a plain imperative, a longer middle line
 * carrying the setting and the escalation to Haseeb, a one-line caution, then
 * the ask. It was the shortest task on the track by line count when it was
 * written and is not any more: day 9 matches it at five and days 5 and 7 are
 * shorter still, at three and four.
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
 * PHLO IS ON THE TEAM PLAN, confirmed by the programme owner in September
 * 2026, so SHARE is the button members see and the copy names it. A shared
 * Artifact opens only for people signed in with their Phlo account; reaching
 * anyone outside needs an organisation Owner to enable external sharing
 * first, which is why the copy routes that case to Haseeb rather than to a
 * setting, the way day 5 routes connector permissions.
 *
 * The first version of this task was written on the Publish behaviour: it
 * said to publish the Artifact, open the link in a browser you are not signed
 * in to, and treated "it asks you to sign in" as the member's own mistake to
 * fix. On the Team plan every member fails that test, and the diagnosis then
 * sends them after a control they do not have. That is the day 7 failure
 * exactly, a task instructing the inverse of the product, and it is the
 * reason to check the plan before writing anything about where an output can
 * travel. The tier is a fact about Phlo rather than about Claude, so it will
 * not turn up in Anthropic's docs and nothing in this repo enforces it: if
 * Phlo ever moves to Enterprise or off Team, this day, the day 8 sharing quiz
 * question and day 12's export line are what to re-read.
 *
 * The safety line is deliberately NOT relaxed for the narrower audience. Org
 * -only sharing is a smaller blast radius than a public link, and it is still
 * the whole company: a shared Artifact opens for anyone at Phlo who has the
 * link, and plenty of them have no business seeing supplier pricing or
 * anything patient-adjacent. Whether "made-up numbers only" is stricter than
 * Phlo wants is the programme owner's call rather than a thing to soften here
 * on the grounds that the link no longer leaves the building.
 *
 * DAY 8 HAS NO FAILABLE STEP, and this note is here so nobody reads that as
 * an oversight. It had one - "share it and have a colleague open the link",
 * which is a real pass or fail - and the colleague was removed on the
 * programme owner's instruction, along with every other line on the track
 * that waited on another person. Nothing replaced it, so the day is now
 * self-marking in the way the day 4 note describes: a member who shares
 * nothing and pastes a chat link has done what the words ask.
 *
 * The reason is worth recording, because it is a constraint rather than an
 * oversight. Phlo runs shifts and the programme has no claim on anybody's
 * colleague, so a task that cannot be finished alone is a task that stalls
 * for the people with the least slack. That trade is deliberate: a
 * self-marking day everyone can finish beats a verified day that waits on
 * somebody else's shift.
 *
 * If a check is ever wanted back, it has to be one the member can run alone,
 * and the honest candidate is the Artifacts list rather than another person:
 * a conversation artifact only appears at claude.ai/artifacts once it has
 * actually been saved or shared, so "check it is listed there" fails for
 * exactly the member who never shared it. That is the cheapest way to make
 * this day pass or fail again without reintroducing the dependency.
 *
 * The two other doc-checked facts in the copy: every version is kept, so a
 * change cannot lose the draft before it, and Artifacts needs "Code execution
 * and file creation" on. That one is written as a diagnosis rather than a
 * first step - "if Claude answers in the chat instead of opening a panel" -
 * and it ends in "ask Haseeb if it is not yours to change", because on Team
 * the setting is gated at Organization settings > Capabilities. The docs
 * describe the member-level toggle under Settings > Capabilities for Free,
 * Pro and Max and do not say the member control disappears underneath the org
 * gate, so the copy names both the place to look and the person to ask rather
 * than asserting which one applies.
 *
 * The safety line is the caution kept from the longer version, moved onto
 * sharing rather than publishing. It is where this tool touches real data.
 *
 * Day 9 is Cowork, rewritten into DAY 5's shape in September 2026 - six
 * prose lines down to four imperative ones. It is the third
 * day on the compressed variant after 7 and 8, and it was moved for the
 * reading-order reason above rather than because the copy was wrong: the
 * eight days before it are all on the earlier shape, so a reflective opening
 * and a standalone safety paragraph made it the odd one out.
 *
 * THE FINAL WORDING IS THE PROGRAMME OWNER'S, supplied line for line and used
 * as given, the way day 6's is. Everything below about the two drafts that
 * preceded it is history rather than justification for the copy that shipped,
 * and the three paragraphs at the end record what the supplied version
 * changed - one of which needs a decision that is not this file's to make.
 *
 * It took a SECOND pass, on the programme owner's instruction, and the note
 * is here because the first pass hit day 8's failure in a new place. Getting
 * the shape right is not the same as getting the language right: five short
 * imperative lines can still be written in a register nobody speaks in. The
 * version that got the structure right opened "Pick a whole job you dread
 * because it is assembly rather than thinking" and closed a line with "It did
 * the assembly, you still own the call" - correct, compact, and not English
 * anyone says out loud. The instruction was to make it sound like a person
 * talking, and what that cost was every abstract noun: "assembly rather than
 * thinking" became "a boring job you keep putting off" and "hand over the
 * whole goal" became "tell it the whole task".
 *
 * The rule that came out of it, worth applying to any day rewritten from
 * here: if a line would sound odd said aloud to a colleague, it is wrong,
 * however well it fits the template. Day 8's note has the structural half of
 * this - prose that survives because the shape wanted something there - and
 * this is the vocabulary half, which the template does not catch because a
 * slot can be filled with a well-turned phrase just as easily as with a plain
 * one.
 *
 * Two things in this copy are load-bearing outside the day, and both are in
 * quiz-content.ts. The FIRST day 9 question tests the examples in the opening
 * line: its correct answer is merging reports "and filing them", against an
 * explanation about work that "ends in files rather than in an answer", so
 * the opening line has to keep at least one example that ends in files. The
 * SECOND now turns on the folder and on skipping permissions together - its
 * stem has the member skipping the prompts and its answer is the folder - so
 * the scoping instruction has to stay AHEAD of the hand-over line and the
 * skip-approvals line has to stay in. A task and its quiz question
 * disagreeing is the failure the day 7 note names.
 *
 * What is NO LONGER load-bearing, since it was until this revision: "tell it
 * the whole task in one sentence". The old second question opened "You have
 * given Cowork a whole goal in one sentence", so the phrase had to survive
 * every rewrite. Its replacement does not mention the brief at all. The line
 * is still the right instruction and still in the copy; it is just no longer
 * pinned by anything outside the day.
 *
 * The examples are down from four to three and which one went was the choice.
 * "Drafting a recurring update out of scattered notes" is the one dropped,
 * because that first question's distractor is drafting an email to a supplier
 * - so a drafting example in the task copy argues against the answer the quiz
 * wants two days later. "Tidying and renaming" was the one to keep for the
 * same reason inverted: it is the clearest case of work that ends in files.
 *
 * The other cost is one sentence: "Scoping it is the safety step, not a
 * tidy-up". The instruction to scope survives in the opening line and the
 * reason survives in the caution line, but the sentence that said the two
 * were the same thing is gone. That is the line to reinstate if members turn
 * up with a folder pointed at their whole Documents directory.
 *
 * THE SUPPLIED VERSION DROPPED THE WATCH-AND-READ LINE. The line was "Keep
 * an eye on it and stop it if it goes wrong. Read what it made properly
 * before you send it anywhere", and losing it briefly left the day teaching
 * the opposite of its own quiz: the second day 9 question marked "On watching
 * it closely enough to stop it, then reading what it made" correct, against a
 * distractor of "Nowhere until it finishes, because steering it defeats the
 * point", and "Skip Permissions" reads closer to the distractor than to the
 * key. THE QUIZ WAS CHANGED RATHER THAN THE TASK, on the programme owner's
 * instruction, so the question is now about what the folder is doing once the
 * prompts are skipped. Which side moves is the decision worth recording: the
 * task is the curriculum and the quiz examines it, so a disagreement between
 * them is normally the quiz's to absorb - the exception is a question that is
 * right about the PRODUCT, which is the day 7 case and which this was not.
 *
 * That leaves DAY 9 WITH NO FAILABLE STEP, joining days 4 and 8. Cowork has
 * to finish and produce something linkable, which a badly scoped folder will
 * stop, but there is no longer any step a member can be seen to get wrong.
 * The reading check was the closest the day had, and it is the honest one to
 * reinstate if a pass or fail is ever wanted back - it is now gone from the
 * quiz as well as the task, so nothing in the programme asks for it.
 *
 * "SKIP PERMISSIONS" WAS THE ONE UNVERIFIED UI STRING IN THIS DAY AND IT WAS
 * WRONG. It came from the programme owner, who uses the product, and this
 * note used to say it was the first thing to re-read if members reported the
 * day not matching what they saw. Checked against Anthropic's docs on
 * 2026-09-11 it is not a label the product has. Cowork names three approval
 * modes, "Manually approve", "Automatically approve" and "Skip all
 * approvals", the last of which is what this day wants, so the copy now says
 * that. See support.claude.com/en/articles/13364135-use-claude-cowork-safely
 * and .../15520349-use-claude-cowork-on-web-desktop-and-mobile, which also
 * records the older names the modes carried ("Ask before acting", "Auto",
 * "Act without asking") - so a member on a lagging build may see one of
 * those, and none of them is "Skip Permissions" either.
 *
 * Day 7's note was the precedent for why an unchecked screen fact matters and
 * this is now the second instance: three of day 7's were wrong for two
 * revisions, invented by analogy rather than checked, and this one was
 * supplied by someone using the product and still did not match it. The
 * general lesson is in the quiz-content.ts header - a product fact rots
 * silently, because nothing in this repo tests one.
 *
 * THE LIVE COHORTS FOLLOWED THE WRONG LABEL. They reached day 9 on
 * 2026-09-10 and this correction landed the day after, and a task edit here
 * does not reach them on its own: programme_seed.sql is generated from this
 * file rather than being a migration, so live `track_items` rows keep the old
 * copy until the seed is run against the linked remote. That is a decision
 * for the programme owner rather than something to do quietly, since it
 * rewrites copy under a cohort mid-programme.
 *
 * The caution line is the owner's too and it is WIDER AND SOFTER than the one
 * it replaced. "Nothing confidential or patient-identifiable in it unless the
 * use has been approved" became "make sure there's nothing unrelated or
 * confidential in it": "unrelated" is new and useful, since it repeats the
 * scoping instruction where a member is actually filling the folder, but
 * "patient-identifiable" is gone as a named category and so is the approval
 * route. Phlo is a pharmacy and this is the day that points a tool at real
 * files on a real machine, so naming patient data explicitly is worth more
 * here than on any other day. Left as supplied because the copy is the
 * owner's; flagged because "confidential" covering patient data is an
 * inference a reader has to make rather than something the line says.
 *
 * DAY 9 NOW HAS A VIDEO. Cowork was recorded and uploaded on 2026-09-10, the
 * morning the two live cohorts reached the day, and `learn_videos` has a row
 * titled exactly "Cowork" - so the seed's own re-bind block fills it, because
 * day 9's `learn_video_id` was null and the titles match. No migration was
 * needed for it, unlike the day 4/5 and 8/11 swaps, which had to re-point or
 * null a binding the seed would not touch.
 *
 * The day was held shut from 07:00 to 09:00 that morning while the upload
 * happened - see DAY_HOLDS in working-days.ts - and released early once the
 * row existed. That is the first use of the hold mechanism and the reason it
 * was written.
 *
 * Research left day 11 entirely on 2026-09-15, so the 9/11 swap note above is
 * history rather than a live argument: the day is Claude Design 2 now and it
 * has a recording.
 *
 * The unrecorded days are 12, 13, 14 and 15 as of 2026-09-15. This sentence
 * has now been wrong three times by being a list; check it against
 * `learn_video_id` on the track items rather than trusting it.
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
 *   - It is as short as the day allows. Day 5 is the template: three plain
 *     instructions, no commentary explaining why the day matters. A member
 *     reads this on a shift with ten minutes, and a paragraph arguing for the
 *     lesson is a paragraph they skip on the way to the step. Whatever the
 *     video is for, it is not this.
 *   - Every one that has a field ends by asking for something to be filed.
 *     Day 5 is the exception at both ends: it has no field and makes no ask,
 *     because what it asks for is settings on the member's own account and
 *     there is nothing to show. LINKLESS_TASK_DAYS in task-link.ts is the
 *     list, and it is what the copy test exempts.
 *
 * That last one is a copy decision, not a mechanism. On the fourteen days
 * that ask, filing stays OPTIONAL in code (see task-link.ts): plenty of real
 * output is a file on a shared drive, and a required field on unlinkable work
 * buys filler links, which are worse than blanks because you can no longer
 * tell which is which. Asking makes filing the norm and puts the field in
 * front of people; the Task evidence table on the admin cohort dashboard is
 * what makes a gap visible - which is also why a day with no field is dropped
 * from that table rather than showing a column of blanks.
 *
 * Days 7 and 14 name the screenshot in their copy, and they are the only two
 * that offer the upload - see SCREENSHOT_TASK_DAYS in task-link.ts. They are
 * the days where the link genuinely does not exist. A scheduled task has runs
 * and no Share link, which is what a member reported after doing the work and
 * finding nothing to paste; Outlook work has neither a message a colleague
 * can open nor a shareable chat, because the M365 add-ins keep their history
 * in the browser rather than in a Claude account. Elsewhere a link is better
 * evidence because it opens, and offering the fallback would invite a picture
 * of a page that could have been shared.
 *
 * The two were briefly out of step: the copy named it on day 7 while the
 * button appeared on all fourteen linkable days. The copy was the side that
 * was right.
 *
 * They are also independent of each other, deliberately, all the way through.
 * The day 4 note explains why: a task that opens "the thing you built on day
 * 3" fails outright for anyone who missed day 3.
 *
 * Three are written from documentation rather than from a video, and are
 * known to be. Days 12, 13 and 14 are the Office extension run and none of
 * the three has been recorded, so every step in them was taken from
 * Anthropic's own pages on 2026-09-15: tracked changes and comment threads in
 * Word, a cell you did not write in Excel, a triage into what needs you and
 * what is noise in Outlook. That is a better kind of thin than the day it
 * replaced - the steps are real and checkable - but none of it came from
 * watching somebody at Phlo do the job. Whoever shoots those three should
 * read the tasks first and change whatever does not match.
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
 * EVERY TASK WAS CUT BACK TO DAY 5'S SHAPE on 2026-09-15, on the programme
 * owner's instruction. Days 1, 3, 5, 7 and 9 were already there and are
 * untouched - 9 in particular, because that copy is the owner's own and the
 * note above explains what was deliberately left in it. The rest lost between
 * one and five lines each.
 *
 * WHAT CAME OUT WAS COMMENTARY, NOT FACTS, and that distinction is the thing
 * to hold if another pass is ever made. Every safety line survived: the
 * Team-plan sharing rule and made-up numbers on day 8, the research-preview
 * caveat on day 10, the scoped folder on day 9, patient data on day 14. So
 * did every step that can fail, every menu path, and every escalation to
 * Haseeb. What went was the sentence after the step explaining why the step
 * matters - "that is the point of today", "the barrier was never capability" -
 * which is the video's job and reads as padding in a card. Day 15 lost the
 * most, four lines, and still carries its six containers and the timed run.
 *
 * Day 13 also lost its "if you turned the cross-app setting on for day 12"
 * line, which was worth losing twice over: it was commentary, and the note
 * below about day 4 says tasks do not depend on each other.
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
    "- one where you are not sure",
    "Predict each outcome before you open Claude and rate it Certain, Fairly confident or Guessing, then run all three, including the one you expect to fail.",
    "Compare the results with your predictions. What worked when you thought it would not is what to delegate next; what came back wrong is what to keep checking.",
    "Submit the link to one of these, preferably the one that surprised you most.",
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
    "Test it. If the output is not what you need, the instructions are missing something, so add it and run it again.",
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
    "Pick one thing you explain to Claude repeatedly: how a report should be laid out, how a summary should be structured, the checks a piece of work has to pass.",
    "Go to Customize > Skills and build a Skill for it, letting the built-in skill-creator draft it from your description. Give it:",
    "- a description saying when to use it",
    "- one task only",
    "- the method it should use",
    "Test it in a fresh chat, asking for the task without naming the Skill, over a few different wordings.",
    "If it does not fire, the description is too vague to match what you asked. Fix it and try again.",
    "Submit the link to the chat where your Skill fired on its own.",
  ].join("\n"),
  7: [
    "Go to Scheduled in the sidebar and use New task to set up one job you do on a rhythm, with a frequency and a time you will be away from your desk.",
    "Click Run now once and choose always allow on the permission prompts you recognise, or a scheduled run stalls waiting for you.",
    "Do not tie it to a folder on your computer: those only run when you are there. Use your Connectors and files saved to your Claude account.",
    "Submit the link to its first completed run, or a screenshot of it if there is no link to share.",
  ].join("\n"),
  8: [
    "Pick something you rebuild most weeks - a status update, a meeting-prep sheet, a checklist - and ask Claude to make it as an Artifact you can reuse.",
    "Change it once in plain English rather than keeping the first draft. If Claude answers in the chat instead of opening a panel, check Settings > Capabilities for Code execution and file creation, and ask Haseeb if it is not yours to change.",
    "Share it. On our Team plan it opens for anyone signed in with a Phlo account, so made-up numbers only, no logins or keys, and ask Haseeb if it has to reach anyone outside.",
    "Submit the link to your Artifact.",
  ].join("\n"),
  9: [
    "Pick a boring job you keep putting off (e.g. merging a few documents into one summary, checking two lists against each other, tidying up and renaming a group of files). Put the files Cowork needs into one folder - don't add anything else.",
    "Open Cowork in the desktop app, point it to that folder and tell it the whole task in one sentence. Then set it to \"Skip all approvals\" to allow it to do the work without asking for approvals.",
    "Cowork works on your real files, so keep this folder small and make sure there's nothing unrelated or confidential in it.",
    "Submit the link to the final output.",
  ].join("\n"),
  10: [
    "Describe one screen or document you wish already existed: a landing page, a settings screen, a pitch deck, a one-pager.",
    "Open Claude Design at claude.ai/design, or from the sidebar in the desktop app. Make it there, then refine it once in plain English rather than taking the first version.",
    "Export what you end up with - the Export button offers PowerPoint, PDF and a standalone page, among others.",
    "It is a research preview, so what comes out is a draft. Keep confidential designs, patient-facing material and private code out of it.",
    "Submit the link to the design, or to the file you exported.",
  ].join("\n"),
  11: [
    "Pick something you have been describing in words and hoping everyone pictures the same way: a screen you want built, a landing page, a one-pager.",
    "Ask Claude Design for it as a working prototype rather than a picture of one, and attach the spec, brief or page of notes you already have.",
    "Ask for three versions rather than one, then take what works from each.",
    "Export it as a PNG or a page, share it for comments, or hand it to Claude Code to build.",
    "Submit the link to the prototype, or to what you exported.",
  ].join("\n"),
  12: [
    "Install the Claude extensions for PowerPoint and Word from Microsoft AppSource. Office calls them add-ins: Home > Add-ins on Windows, Tools > Add-ins on a Mac.",
    "In each one's settings, turn on 'Let Claude work across files'. On our Team plan it is off until somebody turns it on, so ask Haseeb if it is not yours to change.",
    "Use it on a deck you actually have to produce. It builds slides in the template you are already in and edits the ones you have selected.",
    "Then take a document somebody has reviewed and ask for the edit as tracked changes, so you accept it line by line.",
    "Submit the link to the deck or the document you worked on.",
  ].join("\n"),
  13: [
    "Install the Claude extension for Excel the same way, and open a workbook you actually use.",
    "Ask it about a cell you did not write: what it is doing, and what breaks if you change it.",
    "Then move an assumption and let Claude carry it through the model rather than repairing the formulas yourself.",
    "Check the numbers as you would a colleague's. It writes into the open workbook, and it cannot reach a file you have not opened.",
    "Submit the link to the workbook.",
  ].join("\n"),
  14: [
    "Install the Claude extension for Outlook. It is a public beta, and it opens from the ribbon with an email in front of you.",
    "Ask it to triage the inbox you dread on a Monday: what needs you, what it can draft, and what is noise.",
    "Take one of its drafts and read it properly before it goes. It sends under your name.",
    "Keep patient identifiable information out of it.",
    "Submit a screenshot of the triage, since an Outlook message has no link to share, or a link if something you made has one.",
  ].join("\n"),
  15: [
    "List the jobs you moved to Claude over the three weeks, with what each used to take and what it takes now. If you have kept a Time-Back Log, that is the list already.",
    "Then time one of them properly rather than estimating it. Pick the biggest saving you are claiming, run it end to end with the clock going, and write the real number next to your guess.",
    "Then choose the container that job belongs in:",
    "- a Chat for a one-off",
    "- a Project when the background is the same every time",
    "- a Skill when it is a method colleagues should reuse",
    "- a Scheduled Task when it runs on a rhythm",
    "- Cowork when it is assembly across your own files",
    "- an Artifact when the output is a thing your team will open again",
    "If the job you have run in an ordinary Chat all fortnight belongs somewhere else, move it now.",
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
