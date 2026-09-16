/**
 * Knowledge-check questions for the three weekly quizzes.
 *
 * `day` tags follow THE PROGRAMME'S OWN numbering - the index into
 * `DAY_TOPICS` plus one. They used to follow the v5 playbook, which ran one
 * behind, and the offset was re-explained at the top of this file every time
 * somebody edited it. It caused one wrong day reference in question prose and
 * cost a re-tag when days 4 and 5 were swapped, so it is gone:
 *
 *   Week 1 (day 5)  - D1 what AI is doing, D2 when to use it, D3 Prompting,
 *                     D4 Projects, D5 Connectors & MCP
 *   Week 2 (day 10) - D6 Skills, D7 Scheduled Tasks, D8 Artifacts,
 *                     D9 Cowork, D10 Claude Design
 *   Week 3 (day 15) - D11 Claude Design 2 (x2), D12 Word & PowerPoint
 *                     extensions (x2), D13 Excel extension, D14 Outlook
 *                     extension, D15 choosing the right tool and measuring
 *                     time saved (x2), plus one spiral back over week one
 *                     (D5) and one over week two (D7)
 *
 * Every quiz now tests only days that have opened before it does, which was
 * not true before September 2026. Week one's two verification questions were
 * testing "catching confident wrong answers", a day that opens the working
 * day AFTER that quiz, and week two's two Reverse Prompting questions were
 * testing a day that belongs to week three. Both pairs moved one quiz later,
 * into the week that actually teaches them, and week one gained the two day 1
 * questions it had never had - day 1 was inserted at the front of the
 * programme after this file was written and nothing here had ever drawn on
 * it.
 *
 * That cascade is why week three lost a question: it gained Reverse Prompting
 * and shed "share a refined prompt", which was the softest item in the set
 * and duplicated the container-choice question that closes it.
 *
 * Reverse Prompting did not stay. Later in September 2026 "catching confident
 * wrong answers" was cut from the curriculum outright, Skills came forward to
 * day 6 and days 10-15 each moved up one, so Reverse Prompting became a week
 * two day and its question moved back into the week two set. Five questions
 * were touched by that and it is worth knowing which, because only two of
 * them were re-tags of the same prose:
 *
 *   - the two "catching confident wrong answers" questions in week two are
 *     gone, and so is week three's spiral back over that day. Three deletions
 *     rather than three re-tags, because the day no longer exists to test;
 *   - one new Reverse Prompting question was written to partner the one that
 *     moved, since week two now owns that day and a day gets two;
 *   - two new day 15 questions were written for the measurement day.
 *
 * Everything else in weeks two and three is the same prose under a different
 * `day` tag. That is the cheap half of a reorder and the deletions are the
 * expensive half: a question about a day that no longer exists cannot be
 * salvaged by renumbering it.
 *
 * Days 7 and 9 swapped later in September 2026, Scheduled Tasks coming
 * forward and Research/Memory going back. Four questions were re-tagged and
 * no prose moved between quizzes, since both days sit inside week two: the
 * two Scheduled Tasks questions here, the two Research and Memory ones, and
 * week three's container-choice spiral, which was tagged day 9 for the
 * Scheduled Task in its first slot and now follows that topic to day 7.
 *
 * One of them needed more than a tag, and it is the reason to read this
 * paragraph before trusting any question about where work runs. Anthropic
 * moved Cowork's scheduled runs to the cloud in July 2026. The laptop
 * question below had been written on the old behaviour, so it marked "it runs
 * when you open the laptop" correct and offered "it runs on Anthropic's
 * servers and waits for you" as a distractor - which is now the true answer.
 * A formative quiz teaching the inverse of the product is worse than no
 * question, and the day's task said the same wrong thing, so both were
 * corrected together. See the day 7 note in track-spec.ts.
 *
 * DAYS 11 AND 12 WERE REPLACED on 2026-09-15: Research/Memory/files out and
 * Reverse Prompting left the curriculum for "Claude Design 2" and "Claude
 * PowerPoint" - see the stanza in track-spec.ts. Three week three questions
 * went with them, and none of the three could be re-tagged:
 *
 *   - the two Research and Memory questions are deleted. Neither topic is
 *     taught anywhere on the track now, so both were questions about a day
 *     that no longer exists;
 *   - the Reverse Prompting question is deleted for the same reason. Its
 *     recording stays in the Learn library, so the topic is still watchable,
 *     but nobody is walked through it and the summative quiz should not gate
 *     completion on it;
 *   - three new questions replace them, two on day 11 and one on day 12, so
 *     week three still covers each of days 11-15 and still runs to ten.
 *
 * THE DAY 12 QUESTION WRITTEN THAT MORNING DID NOT SURVIVE THE AFTERNOON.
 * "Claude PowerPoint" was replaced by the Office extension run before it opened
 * for anybody, so the question about asking for a deck as a file went with
 * it. It is recorded here because it is the shortest-lived question this file
 * has carried and the lesson is cheap: a question written from a task rather
 * than from a recording is the first thing a change of plan invalidates.
 *
 * The two day 11 questions are written from the recording that day does have,
 * so they test what it shows: a prototype you can click through rather than a
 * picture of one, and attaching the document you already have rather than
 * describing it. The second also carries the three-versions habit in its
 * explanation, which is the part of that video most likely to be skipped.
 *
 * DAYS 12, 13 AND 14 BECAME THE OFFICE EXTENSION RUN later on 2026-09-15:
 * PowerPoint and Word, Excel, then Outlook. Three questions were replaced,
 * one per day, and each is written from Anthropic's own documentation rather
 * than from a recording, because none of the three days has been shot. What
 * they test is what the add-ins actually do and where the judgement sits:
 * tracked changes on a document somebody has reviewed, a live workbook you
 * can ask about a cell in, and a draft reply that goes out under your name.
 *
 * TWO LESSONS LEFT WITH THE OLD DAYS and the difference between them matters.
 * "Claude everywhere" is absorbed: its friction argument - that the cost was
 * never capability, it was stopping, switching app and pasting back - is now
 * carried in the day 12 explanation, where it belongs to a day that actually
 * removes the switch. "Dispatch + Plugins" is a straight loss. The question
 * that tested the difference between a prompting problem and a capability
 * problem is deleted, and nothing else on the track teaches it. If it is
 * wanted back, day 15 is the only room left.
 *
 * WEEK THREE WAS REFRESHED AGAINST THE CURRICULUM on 2026-09-15, after day
 * 12 was recorded. Three changes, and the reason for each is the same: the
 * quiz should test the days as they now are rather than as they were when
 * each question was written.
 *
 *   - day 12 gains a second question and now has two, like days 11 and 15.
 *     It is the only day in the run with two apps in it, and a single Word
 *     question left the PowerPoint half untested. The new one is written from
 *     the recording: targeted edits to slides you have already selected, and
 *     the choice between seeing each edit and letting it apply them all,
 *     which is the setting that decides what you end up with;
 *   - the day 3 spiral is deleted to make room. It asked which letter of
 *     CRISPE means constraints, which is recall of a framework rather than
 *     the judgement the rest of the set tests, and day 3 is already covered
 *     twice in the week one quiz. Week one still spirals here through day 5;
 *   - the day 7 mapping question swaps a "Plugin" distractor for "Artifact".
 *     Plugins left the curriculum with "Dispatch + Plugins", and a distractor
 *     naming a container nobody was taught is eliminated by unfamiliarity
 *     rather than by judgement - and worse, now reads as the Office
 *     extensions under an older name.
 *
 * The Word question stayed and its explanation gained what the recording
 * shows: asking Claude to summarise a document's comments and say where they
 * conflict. Days 13 and 14 stayed as they are, written from documentation,
 * because neither has been recorded yet - and when they are, both should be
 * read against the video the way day 12's pair now has been.
 *
 * ALL THIRTY EXPLANATIONS WERE REWRITTEN IN PLAIN SPEECH on 2026-09-16, the
 * same pass the tasks had the day before and for the same reason. The
 * questions and the options were left alone: they are short, the tests
 * constrain their lengths against each other, and the slop had collected in
 * the explanations, where there is room for it.
 *
 * The tells, all now at zero across the file: "X rather than Y" stacked more
 * than once in a paragraph, the semicolon joining two balanced clauses, "which
 * is exactly why", and the closing aphorism that restates the lesson in a
 * shape nobody speaks in. An explanation is read once, by somebody who has
 * just got a question wrong, so it should sound like a colleague explaining
 * rather than a textbook summarising.
 *
 * Nothing about any answer changed. Every fact, every reason a distractor is
 * wrong and every safety point survived the rewrite, which is the thing to
 * check if this is ever done again: the register is what is being edited, and
 * an explanation that loses a reason has been rewritten too far.
 *
 * The lesson for the next edit: a `day` tag rots loudly, because a test reads
 * it, and a product fact rots silently. Nothing in this file checks that an
 * answer is still true.
 *
 * Days 8 and 11 swapped later still in September 2026, Artifacts coming
 * forward and Cowork going back. This is the first reorder that crossed a
 * QUIZ boundary rather than moving days around inside one, and it is the
 * expensive kind: day 8 sits in week two and day 11 in week three, so the
 * questions had to move between arrays rather than take a new tag in place.
 *
 * The arithmetic is worth spelling out, because it is what forced a deletion.
 * Week two must be exactly ten and must cover days 6-10, which the test
 * asserts day by day. Days 6, 7, 9 and 10 carry two questions each, so day 8
 * has to carry two as well. Artifacts arrived with ONE - week three gives its
 * core days one question each, except the measurement day - so a second
 * Artifacts question was written for it, on publishing and what it changes
 * about who can see your figures. That is the day's own safety line and the
 * facet the existing question does not touch.
 *
 * Week three then went the other way, and this is where the swap cost
 * something. Its shape was one question per core day plus the day 15 pair
 * plus four spirals, which is ten; Cowork arriving with two made it eleven.
 * Both Cowork questions are kept, on the programme owner's call, so the room
 * came from the spirals: the day 1 Time-Back Log question was dropped.
 *
 * It was picked over the other three because it was the redundant one. Day 15
 * already carries two questions on totalling a saving and one of them turns
 * on exactly the same arithmetic, the difference rather than the old cost, so
 * the final quiz was asking a fluent member to do that sum three times. The
 * day 3 and day 5 spirals test material nothing else in week three touches,
 * and the day 7 one is the only week two callback the quiz has - the test
 * requires a question from each earlier week band, so day 7 could not be the
 * one to go.
 *
 * What that costs is worth stating rather than filing as a tidy-up. Week
 * three no longer spirals back over day 1, so the entry day is tested only in
 * week one, which is the formative quiz that gates nothing. Nothing has been
 * lost from the curriculum - the Time-Back Log is day 1's task, day 15's task
 * is built on it and two day 15 questions examine it - but the summative quiz
 * now reaches back over days 3, 5 and 7 rather than 1, 3, 5 and 7, so its
 * week one coverage is one question thinner. If a fourth spiral is ever
 * wanted back, the honest way to make room is a question on a core day that
 * carries two, not another spiral.
 *
 * The first version of this swap resolved the same arithmetic the other way,
 * deleting the "strongest candidate for Cowork rather than an ordinary Chat?"
 * question and keeping only "where does your attention belong?". The argument
 * was that week three already closes on a container-choice spiral and day
 * 15's task lists six containers, so a third pass at that judgement was the
 * cheapest thing in the set. That reasoning was not wrong, and it is recorded
 * here because it is the argument to weigh again if this quiz is ever over
 * length: the two Cowork questions test different things - which work belongs
 * in the tool, and what you owe the output once it has run - and the case for
 * cutting one was about crowding rather than about either being weak.
 *
 * Days 9 and 11 swapped straight after, Cowork forward and Research back, and
 * this one cost nothing. Both days carry two questions, so the pairs traded
 * places one for one - Cowork's two out of week three and into week two,
 * Research's two the other way - and both quizzes stayed at ten with their
 * day coverage intact. That is the difference from the 8/11 swap a moment
 * earlier, which moved a two-question day against a one-question day and had
 * to find the difference somewhere. Worth checking before the next reorder:
 * count the questions on both days first, and a swap between two days that
 * carry the same number is free.
 *
 * No question needed a fact corrected this time. Both topics kept their prose
 * exactly; what changed is which array it sits in and what its tag says.
 *
 * Day 9's SECOND question was rewritten in September 2026 and this is the
 * first time a question changed because the TASK moved rather than because
 * the day did. The programme owner supplied new day 9 copy which drops "Keep
 * an eye on it and stop it if it goes wrong. Read what it made properly
 * before you send it anywhere" and adds an instruction to click Skip
 * Permissions. The old question asked where the member's attention belongs
 * during a run and marked "On watching it closely enough to stop it, then
 * reading what it made" correct - so the task was teaching one thing and the
 * quiz marking another, and the "Nowhere until it finishes" distractor had
 * become the closer description of what the day now asks for.
 *
 * The quiz moved rather than the task. That is the general rule and it is
 * worth stating once: the task is the curriculum and the quiz examines it, so
 * when they disagree the quiz is normally the side to change. The exception
 * is a question that is right about the PRODUCT - the laptop question above
 * is that case, where the task and the quiz were both wrong and both were
 * corrected against Anthropic's docs rather than against each other.
 *
 * The replacement keeps the day at two questions and tests the day's own
 * safety line, the way day 8's second question does: with the permission
 * prompts skipped there is no per-step check left, so the folder chosen
 * before the run is the only boundary there is. Its near-miss fifth option is
 * reading every file afterwards, which is worth doing and is not a boundary.
 *
 * What went with the old question is real and is not replaced anywhere:
 * nothing in the programme now asks a member to read what Cowork produced
 * before acting on it. See the day 9 note in track-spec.ts, which records the
 * same gap from the task's side.
 *
 * The day 7 stem was corrected in the same pass. It said "You set a Scheduled
 * Task in Cowork", which is the navigation claim the day 7 task copy had
 * already been corrected for: Scheduled is its own top-level item in the left
 * sidebar and is not reached through Cowork. The stem now says "From
 * Scheduled in the sidebar", which is what the task tells members to do. The
 * question's judgement is untouched - it is still about where a run happens
 * when the laptop is shut.
 *
 * WEEK TWO WAS CHECKED AGAINST ANTHROPIC'S DOCS ON 2026-09-11, all ten
 * questions, on the day the live cohorts reached the quiz. This is the first
 * deliberate sweep rather than a fact corrected because something else forced
 * an edit, and it is recorded question by question because the value is in
 * knowing what was looked at and not only what moved. Sources are the Claude
 * help centre articles named below, all under support.claude.com/en/articles.
 *
 * ONE ERROR, day 9's second question. Its explanation said "Cowork works on
 * your real machine rather than inside your Claude account", which inverts
 * the current product on Phlo's own plan: "Run Cowork in the cloud" is on by
 * default for Team (13455879), the agent loop and code execution run on
 * Anthropic's servers, and sessions and files are saved to the member's
 * Claude account (14479288). The clause was refuting the "desktop app"
 * distractor with a fact that is no longer true. The key did not move and
 * neither did any option: the folder is still the boundary, and the docs put
 * it more plainly than the question did, at "only for the folders you've
 * connected". The explanation now says the desktop app is the route to the
 * disk rather than a limit on it. Same shape as the laptop correction above,
 * and the same lesson: the judgement was right and the supporting fact rotted
 * underneath it.
 *
 * THE OTHER NINE HOLD. Day 6 on descriptions as the trigger (12512180), day
 * 7 on cloud execution, connectors travelling with a run and "Scheduled" plus
 * "New task" in the sidebar (13854387, which also confirms a scheduled task
 * cannot be tied to a folder on your computer), day 8 on Team sharing
 * (9547008), and both day 10 questions, which at that point were the reverse
 * prompting pair and carried no product surface at all - a technique rather
 * than a feature, so there was nothing there to go stale. Day 10 is Claude
 * Design as of later the same day and those two questions are gone; see the
 * swap note below. Three of the nine hold on the fact the question
 * turns on while carrying a looser clause around it, which is the next
 * section rather than a qualification of this one.
 *
 * THREE TENSIONS LEFT DELIBERATELY UNEDITED AT THE TIME. Two of the three
 * were reopened and fixed later the same day and the third still stands - the
 * second sweep below records which and why, and this list is left as it was
 * written so the reasoning that first parked them is still legible. The
 * argument for parking them was that in each the key still wins its set and
 * admitting the nuance would weaken a question that is right:
 *
 *   - day 9's first question calls a market write-up "Research, which needs
 *     sources rather than your file system". Cowork's own docs now list
 *     synthesising research among its uses (13345190), so that refutation is
 *     softer than it reads. Assembly across a folder is still the strongest
 *     of the five;
 *   - day 6's first question says a Skill fires "in anybody's Chat". A shared
 *     Skill is view-only and stays off until the recipient enables it
 *     (12512180), so "anybody" means anybody who has turned it on. It is
 *     still the property that separates a Skill from a Project;
 *   - day 8's second question says a shared Artifact "opens for anyone at
 *     Phlo with the link". Team sharing lets you grant access to named people
 *     as well as to everyone (9547008), so that is the worst case rather than
 *     the only one. It is left as written because it is the programme owner's
 *     recorded safety framing - see the day 8 note in track-spec.ts - and
 *     because the stem is a link share, where it is simply accurate.
 *
 * Every edit in this pass was to an explanation, and that was a constraint
 * rather than a coincidence. The cohorts were sitting this quiz the morning
 * it ran, and `alignAttempt` in quiz-results.ts reads a stored attempt back
 * against today's content: changing a `correct`, reordering options or
 * rewriting a stem either drifts a stored score or misreports what a member
 * saw. An explanation is the one field that is shown after answering and
 * scores nothing, so it can be corrected under a live quiz. Worth knowing
 * before the next correction, because it decides how much of a wrong question
 * can be fixed in place and how much has to wait.
 *
 * CLAUDE DESIGN AND REVERSE PROMPTING SWAPPED DAYS on 2026-09-11, Design
 * coming forward from day 12 to day 10 and Reverse Prompting going back the
 * other way, on the programme owner's instruction. Three questions moved with
 * them and the tag distribution did not change at all - week two still covers
 * 6,7,8,9,10 and week three still covers 11,11,12,13,14,15,15 plus the spiral
 * over 3,5,7. That is the point of doing it this way: each quiz keeps testing
 * the day that sits under its own tag, so nothing had to be re-tagged and no
 * quiz changed length.
 *
 *   - week two's two day 10 questions were about reverse prompting and are
 *     now about Claude Design, written fresh rather than re-tagged, because
 *     the day beneath them changed topic entirely;
 *   - week three's day 12 question was the Claude Design one and is now a
 *     reverse prompting question, for the same reason in the other direction.
 *
 * WHAT DECIDED WHICH SIDE COULD BE REWRITTEN FREELY. Week two had ZERO stored
 * attempts, so its two questions were rewritten without constraint. Week
 * three had twenty, all of them the Rehearsal cohort, which is a test cohort
 * - no real member has sat that quiz.
 *
 * Those twenty turn out to cost nothing at all, and it is worth recording WHY
 * rather than leaving the next editor to re-derive it. Every one of them
 * stores `answers_json` as `{}`: they are seeded rows carrying a score and no
 * answers, ten sixes and ten nines. `readAnswers` returns [] for that, so
 * `alignAttempt` compares a zero-length array against ten questions and has
 * already returned "unreadable" for all twenty since before this edit, and
 * resolveAnswers is never reached, so per-answer review shows nothing for
 * them either. The edit cannot degrade what was never readable.
 *
 * The replacement question was written to five options with `correct` left at
 * index 3 regardless, so the whole `correct` array is byte-identical and
 * scoreAttempt returns the same total for any attempt that did carry answers.
 * That is the property that would have mattered, and it is cheap to preserve,
 * so it was preserved rather than relied on being unnecessary.
 *
 * WEEK ONE WAS NOT TOUCHED and could not have been on these terms: it holds
 * forty attempts from Cohorts 1A and 1B, real members, and they are the ones
 * whose data a question rewrite would actually damage.
 *
 * The live cohorts had not reached either day when this ran - day 10 opened
 * for them on 2026-09-11 with nobody yet started on it, and all existing day
 * 10 and day 12 progress belonged to the Rehearsal cohort from June. A swap
 * renames items in place rather than moving rows, so had a live member
 * already completed day 10, they would have been left holding a completion
 * for a topic they never did.
 *
 * WEEK TWO WAS SWEPT A SECOND TIME on 2026-09-11, after Claude Design took
 * day 10, and this pass was asked for rather than prompted by an edit: is the
 * quiz still about days 6 to 10, does it still match Anthropic's docs, and is
 * it in week one's shape. The shape answer is yes and is worth stating once
 * so it stops being re-derived. Both weeks run ten questions, two per day,
 * five options each, every stem a scenario ending in a question mark, no
 * option ending in a full stop, no dashes anywhere in question prose, and in
 * neither week is the correct answer the longest option in its set. That last
 * one is a real rule, not an observation - it is the only thing stopping a
 * member scoring by length - and it is worth re-running after any edit.
 *
 * TWO OF THE THREE PARKED TENSIONS TURNED OUT TO BE WORTH FIXING, now that
 * the quiz had to be defended as current rather than merely not-wrong:
 *
 *   - day 6's first question had a Skill firing "in anybody's Chat". A shared
 *     Skill is greyed out until the recipient enables it (12512180), so the
 *     option now reads "They turn it on once, then it fires by itself" and
 *     the explanation names the switching-on step. The key did not move: the
 *     property that separates a Skill from a Project is still that Claude
 *     reaches for it without being asked;
 *   - day 9's first question offered "Researching a market and writing the
 *     findings up properly" as a DISTRACTOR, and Cowork's own docs list
 *     research synthesis among its uses (13345190). A distractor the docs
 *     endorse is not a distractor. It is now "Working through a live document
 *     with a colleague at the same time", which the same docs rule out -
 *     Cowork has no session sharing - and the explanation says so.
 *
 * The third stands. Day 8's "opens for anyone at Phlo with the link" is
 * accurate on a Team plan, where a shared Artifact is org-internal and the
 * viewer signs in (9547008); it is the owner's recorded safety framing and
 * the stem is a link share. Its explanation gained the fact the docs lead
 * with, which the question had been making its point without: a shared
 * Artifact carries the files attached to the conversation that built it.
 *
 * WHAT THE SWEEP CONFIRMED RATHER THAN CHANGED. Day 7 holds exactly, and it
 * is the one most likely to be doubted: scheduled runs happen on Anthropic's
 * servers "even when your computer is asleep or the Claude Desktop app is
 * closed", they keep connected tools, skills and plugins, and "Scheduled" is
 * the left-sidebar item (13854387). Day 8's first question holds including
 * its fifth option, which the docs refute directly - a viewer cannot edit
 * your artifact, only copy it into their own chat. Day 9's second holds on
 * the folder boundary (13364135). Both day 10 questions were written the same
 * morning against the Claude Design pages and were re-read rather than
 * re-checked.
 *
 * ONE THING THIS PASS DELIBERATELY DID NOT TOUCH. Week three carries three
 * questions whose correct answer IS the longest option in its set, at days
 * 12, 13 and 14. Week two has none and week one has none, so week three is
 * the outlier and it is a real flaw rather than a stylistic one. It was left
 * because this was a week two pass and week three is the summative quiz; it
 * is the obvious next piece of work and it is cheap, because the fix is
 * lengthening a distractor rather than touching any key.
 *
 * A THIRD PASS ON 2026-09-11 ASKED ONE QUESTION ONLY: can a member who knows
 * the material be in any doubt about which option is meant, however hard the
 * question is. Difficulty is wanted; a defensible second answer is not. Two
 * questions failed that and the rest held.
 *
 *   - day 8's fifth option was "Ask Claude to take out anything sensitive
 *     before you share the link". That ends where the key ends, with no real
 *     prices in the artifact, so it was a partial-credit answer rather than a
 *     wrong one - the explanation refuted it on Claude's judgement, which is a
 *     claim about the delegation rather than about the action, and a member
 *     who named the prices would have got a safe artifact. It is now "Share it
 *     with only the two colleagues who actually need it", which fails on the
 *     thing the question is actually about and touches the data not at all;
 *   - day 6's third option was "It runs the task automatically each morning
 *     without being asked", which carried the Skill's property ("without being
 *     asked") and the Scheduled Task's ("each morning") in one line, so the
 *     margin between it and the key was a single adverbial phrase. It is now
 *     "It runs to a timetable, whether or not the job came up".
 *
 * THE THIRD PARKED TENSION WAS NOT A TENSION AND THE NOTE ABOVE IS WRONG. It
 * records that "Team sharing lets you grant access to named people as well as
 * to everyone (9547008)", which made day 8's "anyone at Phlo with the link"
 * read as the worst case rather than the plain case. Asked that article
 * directly, there is no per-person or named-recipient control for artifacts:
 * a shared artifact is reachable by "only members of your Team or Enterprise
 * organization", which is everyone in it who has the link. So the question
 * was simply accurate all along, and the same fact is now what makes its new
 * fifth option wrong. Left as two entries rather than one edit because the
 * first was read through a summariser and this was asked of the article
 * head-on - the difference between those two is the whole reason this file
 * keeps saying what was checked and how.
 *
 * Day 8's key also lost the clause "because sharing widens who can see it".
 * No other option in that set argues for itself, so carrying a reason marked
 * it out; the reason belongs in the explanation and is there. That dropped it
 * from 76 characters to 57 against a field topping out at 80, which is the
 * length rule pulling the same way as the ambiguity one for once.
 *
 * WHAT WAS LOOKED AT AND LEFT. Day 7's "leave it running, since it is still
 * saving you time overall" is dominated by the key on either branch, so it is
 * a trap rather than a rival. Day 9's "nothing much, so read every file it
 * touched" is the documented near-miss and fails the stem's own question,
 * which asks what is keeping Cowork away from files rather than what you
 * should do afterwards. Both are difficulty and both stay.
 *
 * TAGS ARE EDITORIAL. Which quiz a question lands in is the array it sits in,
 * never this field. It exists so `tests/programme-quiz-content.test.ts` can
 * assert that each quiz covers its own week, which is the check that would
 * have caught all of the above.
 *
 * Still do NOT put a day number into question prose. A tag moves with a
 * reorder because a test reads it; a sentence does not, and the one question
 * that carried "the prompt framework from day 3" had already been corrected
 * once for exactly that.
 *
 * HOUSE STYLE, enforced by tests/programme-quiz-content.test.ts:
 *   - no em dashes anywhere in a question, option or explanation; use a hyphen
 *   - no Oxford comma before "and" in a list
 *
 * Design notes, so edits keep the character:
 *
 * - FIVE options, not four. Four options give a guess a 25% floor, and on a
 *   ten-question quiz passing at eight that floor is doing real work. The
 *   fifth is never filler: it is the near miss, the answer somebody fluent
 *   would reach for. Enabling only the permissions a job needs IS good
 *   practice, and day 5's task asks for it, and it is still not what makes a
 *   Connector safe.
 * - SCENARIOS, not definitions. "What is a Project?" tests reading; "you are
 *   about to do X, what is the better move?" tests judgement, which is what
 *   the programme is for. There is no recall question left in the set.
 * - OPTIONS OF COMPARABLE LENGTH. This is the one that is easy to lose and
 *   costly to lose. Writing a careful correct answer and four throwaway
 *   distractors made the right option the longest in 25 of the 30 questions,
 *   often by three times, so the whole set was passable by picking the long
 *   one without reading it. Nuance belongs in the explanation, which is where
 *   it teaches, rather than in the option, where it gives the answer away.
 *   tests/programme-quiz-content.test.ts holds the line at 1.25x the longest
 *   distractor.
 * - NAME THE TOOL AND THE SURFACE. "You ask for a price" leaves a reader
 *   guessing whether this is a Chat, a Project or a Connector, and that guess
 *   changes the answer. Every stem says Claude and says where you are, so no
 *   question is harder than it means to be. The difficulty belongs in the
 *   judgement rather than in working out what is being asked.
 * - PITCHED AT SOMEONE ALREADY FLUENT. The wrong answers a beginner picks are
 *   cheap to write and teach nobody anything by week three. The ones worth
 *   including are the plausible next step, the true statement that answers a
 *   different question and the sophisticated fix that misses the actual
 *   failure - a citation that exists is still not a citation that supports
 *   the claim.
 * - Scenarios are spread across the company: dispensary, fulfilment, finance,
 *   marketing, people, product, data and governance. Patient-facing clinical
 *   advice is deliberately NOT the running theme - Phlo already has a
 *   dedicated AI support tool grounded in the knowledge base, so drilling
 *   "escalate to a pharmacist" would teach a reflex people already have and
 *   crowd out the material that actually changes how they work.
 * - Explanations say why the wrong answers are wrong, because the explanation
 *   is shown after answering and is where most of the learning lands.
 */

export type QuizQuestion = {
  question: string;
  options: [string, string, string, string, string];
  /** Index into `options`. */
  correct: 0 | 1 | 2 | 3 | 4;
  explanation: string;
  /**
   * Curriculum day this draws on, in the programme's own numbering: the
   * index into `DAY_TOPICS` plus one. Editorial only - which quiz a question
   * lands in is decided by the array it sits in, not by this.
   */
  day: number;
};

/* ------------------------------------------------------------------ */
/* Week 1 - day 5. Ten questions, pass 8. Curriculum days 1-5.         */
/* ------------------------------------------------------------------ */


export const WEEK_1_QUESTIONS: QuizQuestion[] = [
  {
    day: 1,
    question:
      "In an ordinary Chat, with web search turned off and no Connectors enabled, you ask Claude for the current list price of a product line. It answers with a precise figure, to the penny. Where did that number come from?",
    options: [
      "It looked the price up and reported back what it found",
      "It calculated it from related figures that it does hold",
      "It predicted a plausible figure from patterns in its training data",
      "It reported the last value it saw, so it is current unless the price moved",
      "It inferred it from your earlier messages in this Chat",
    ],
    correct: 2,
    explanation:
      "Nothing was looked up. Claude predicts the next words, so a figure turns up in whatever shape the sentence needs, and the two decimal places are a writing habit, not evidence. When the number is right, that is the training data happening to agree with reality. Anything that changes over time needs a Connector, or a source you open yourself.",
  },
  {
    day: 1,
    question:
      "Two hours into a long Chat, Claude starts breaking a formatting rule you set at the very beginning and had been following all along. What is the likeliest cause?",
    options: [
      "It has decided your later instructions override the earlier one",
      "The Chat has outgrown what Claude can hold in view at once",
      "Output quality degrades over a long session, so it needs restarting",
      "Its training data disagrees with the rule that you set",
      "The rule was not stated firmly enough for it to stick",
    ],
    correct: 1,
    explanation:
      "Everything Claude can see has to fit in one window, and a long chat pushes the start of it out of range. Say the rule again, or carry the essentials into a fresh chat. Saying it more firmly will not help. The instruction is not being ignored, it is no longer visible.",
  },
  {
    day: 2,
    question:
      "Which of these is the weakest candidate for handing to Claude?",
    options: [
      "Drafting the first version of a recurring internal update",
      "Summarising a supplier contract you will read properly afterwards",
      "Signing off the final numbers in the month-end pack",
      "Reformatting a messy stock export into a consistent structure",
      "Drafting a tender rejection letter that is reviewed before it goes",
    ],
    correct: 2,
    explanation:
      "Drafting, summarising and reformatting are where Claude saves you time, and an awkward subject does not change that as long as you read the draft before it goes. Signing off is the one thing that cannot move, because you cannot hand over being accountable. Use Claude to prepare what the decision rests on, then make the decision yourself.",
  },
  {
    day: 2,
    question:
      "Two colleagues use Claude on similar work. One handed over a whole process end to end and is disappointed. The other handed over only the drafting and is not. What explains the gap?",
    options: [
      "The second colleague simply writes better prompts than the first",
      "Judgement and accountability do not transfer, but drafting does",
      "The first colleague is working on genuinely more complex material",
      "The second colleague has been using the tool for a lot longer",
      "The first colleague needs a Project and the second already has one",
    ],
    correct: 1,
    explanation:
      "Complexity is not the dividing line, and neither is being good with the tool. What moves across is the blank page and the repetitive middle. What does not is deciding and owning the result, so handing over a whole process always disappoints at the point where somebody has to answer for it. Prompting and Projects both help, and neither changes that.",
  },
  {
    day: 3,
    question:
      "A prompt in a Chat returns content that is accurate and complete, but it reads like a different company wrote it. Which part of CRISPE is missing?",
    options: [
      "Context",
      "Instructions",
      "Parameters",
      "Role",
      "Style",
    ],
    correct: 4,
    explanation:
      "Style is tone, register and voice. The content being right tells you Context and Instructions did their job. Role changes the expertise Claude writes from, not the voice it writes in, and Parameters set length, format and what to leave out. Correct but reads wrong means Style.",
  },
  {
    day: 3,
    question:
      "You have to write this month's report in exactly the same shape as last month's: the same sections, in the same order, with the same kind of summary at the top. Which part of CRISPE does most of the work?",
    options: [
      "Instructions, listing out every formatting rule you can think of first",
      "Example, pasting last month's report so it can copy the shape",
      "Parameters, specifying the length and the number of sections",
      "Context, explaining who reads the report and what they need from it",
      "Role, so it writes as the person who produced the original one",
    ],
    correct: 1,
    explanation:
      "One example says more than a page of rules, and it clears up the ambiguity a description always leaves behind. Parameters and Instructions can get the shape close and will never get the phrasing. Role and Context change how Claude thinks about the job, not what it hands you.",
  },
  {
    day: 4,
    question:
      "Every week you paste the same background into a new Chat before you can ask your real question: your team's terminology, the format you need and the standing constraints. What fixes that properly?",
    options: [
      "Keep the preamble in a note and paste it at the top of each Chat",
      "Write one much longer prompt so that nothing important gets missed",
      "Ask Claude to remember the background at the end of each Chat",
      "Put the background and reference files in a Project",
      "Add a Connector to the systems that background describes",
    ],
    correct: 3,
    explanation:
      "A Project holds the background, so every chat inside it starts briefed and nobody keeps a preamble up to date by hand. A pasted note goes out of date the moment the format changes, and a longer prompt just moves the repetition somewhere else. A Connector fetches live data, which is a different problem.",
  },
  {
    day: 4,
    question:
      "A Project you built answers the exact question you built it around very well, and anything slightly different badly. What does that tell you?",
    options: [
      "The knowledge files you gave it are too small to generalise from",
      "Projects are built for one job, so varied work belongs in a Chat",
      "The instructions describe one task rather than how you work",
      "You need a separate Project for each question you want to ask",
      "Requests have to be phrased the way you phrased the original one",
    ],
    correct: 2,
    explanation:
      "A Project that only answers the question you built it around is a saved prompt with extra steps. The background is the method, the vocabulary and the constraints, and all of that carries across requests. Building one per question gives you more to maintain and the same problem again in a month.",
  },
  {
    day: 5,
    question:
      "Several times a day you copy the same figures out of the same system and paste them into a Chat. What is that a signal for?",
    options: [
      "A Connector, so Claude can reach the system itself",
      "A longer prompt that carries more of the background with it",
      "A Project holding the most recent export of those figures",
      "Nothing, copy and paste is perfectly fine at that volume",
      "A Scheduled Task that pastes the figures in for you each morning",
    ],
    correct: 0,
    explanation:
      "Copying the same figures by hand several times a day is the clearest sign a Connector will pay for itself. A Project holds background that changes slowly, and an export dropped into one is out of date the moment you save it. A schedule automates the ferrying, so you get the same stale figures on a timer.",
  },
  {
    day: 5,
    question:
      "A colleague worries that connecting a system to Claude will expose data they are not allowed to see. Which of the following is correct?",
    options: [
      "They are right, a Connector reads the system and bypasses its permissions",
      "Connectors are limited to data that the system already publishes openly",
      "It depends entirely on which Connector and which system it is",
      "It is safe provided they enable only the permissions the job needs",
      "A Connector works within the access they already have",
    ],
    correct: 4,
    explanation:
      "A Connector is a route, not a promotion. Your colleague sees what their own login already lets them see. Checking the permissions a Connector allows by default is still worth doing, and the day's task asks for it, but that is not what keeps the answer safe. Worth being clear about in a regulated business, because the worry is common and it puts people off something useful.",
  },
];

/* ------------------------------------------------------------------ */
/* Week 2 - day 10. Ten questions, pass 8. Curriculum days 6-10.       */
/* ------------------------------------------------------------------ */


export const WEEK_2_QUESTIONS: QuizQuestion[] = [
  {
    day: 6,
    question:
      "You have a reliable method for a recurring task and two colleagues want to use it. What makes a Skill the right home for it, rather than a Project or a saved prompt?",
    options: [
      "They turn it on once, then it fires by itself",
      "It stores the documents the task needs alongside the method",
      "It runs to a timetable, whether or not the job came up",
      "It gives Claude access to the system that the task depends on",
      "It keeps the method private to the colleagues you name on it",
    ],
    correct: 0,
    explanation:
      "A Skill packages how you do something so other people's chats can reach it. A colleague switches it on once, and after that the description is what makes it fire without anyone naming it. Documents belong in a Project, a timetable is a Scheduled Task, and system access is a Connector. Picking the wrong one is what makes simple work feel like hard work.",
  },
  {
    day: 6,
    question:
      "You built a Skill and it never fires unless you name it explicitly in the Chat. What is almost always wrong?",
    options: [
      "The instructions inside the Skill have grown too long to parse",
      "It has to be shared with your team before it will trigger at all",
      "The task is too narrow for a Skill to be the right container",
      "Its description is too vague to match what people actually ask",
      "Skills only fire automatically for the person who created them",
    ],
    correct: 3,
    explanation:
      "The description is the trigger. Use this when formatting a monthly performance report fires when it should. Helps with reports never fires at all. Sharing changes who can reach a Skill, not whether it triggers, and a narrow task is exactly what a Skill wants.",
  },
  {
    day: 7,
    question:
      "From Scheduled in the sidebar you set a task to run the stock summary at 07:00 each Monday. You reach your desk at 08:30 and your laptop was shut overnight. What happens?",
    options: [
      "It waits until you open the laptop, so the result arrives late",
      "It ran at 07:00 without your machine, and the result is waiting",
      "It is skipped entirely and runs again the following Monday",
      "It fails, and you get a notification telling you that it failed",
      "It ran at 07:00 but could not reach your Connectors while you were away",
    ],
    correct: 1,
    explanation:
      "Scheduled runs happen on Anthropic's servers, so they keep to their timetable with your computer asleep and the desktop app shut, and your connected tools go with them. Nothing is deferred, skipped or failed. The one thing that still needs your machine is a task reaching files or apps on it. That is why you build a schedule on your Connectors and on files saved to your Claude account, and not on a folder.",
  },
  {
    day: 7,
    question:
      "A Scheduled Task you set up three weeks ago still runs, but you now rewrite most of its output before you use it. What should you do?",
    options: [
      "Leave it running, since it is still saving you time overall",
      "Delete it and go back to doing the whole task by hand again",
      "Run it more often so that its output stays closer to current",
      "Keep it, and log the saving as the full time the task once took",
      "Fold what you keep rewriting back in, or retire the task",
    ],
    correct: 4,
    explanation:
      "Heavy editing means the task and the real work have drifted apart, and what you keep rewriting is the specification. Running it more often just gives you more to correct. Logging the old full cost is how a time saving turns into a number nobody believes. The saving is what the job costs now against what it cost before.",
  },
  {
    day: 8,
    question:
      "You have asked Claude for a checklist your team will use every week. Why ask for it as an Artifact rather than as text in the Chat?",
    options: [
      "Artifacts are generated faster than the same answer in a Chat",
      "Claude is more accurate when it writes into an Artifact",
      "You get something you can edit, version and share on its own",
      "It uses fewer messages, so you get more out of your limits",
      "Anyone you share it with can edit your copy of it directly",
    ],
    correct: 2,
    explanation:
      "An Artifact is the output as an object instead of chat scrollback. You refine it in place, every version is kept, and you can share the checklist with people who do not need the conversation behind it. Speed and accuracy are the same either way. Sharing lets other people open and use it, which is not the same as giving them edit rights on yours.",
  },
  {
    day: 8,
    question:
      "You have built a margin calculator as an Artifact in Claude and you are about to share the link so your team can use it. This quarter's real supplier prices are typed into it. What has to happen first?",
    options: [
      "Share it, then message the team asking them not to forward the link",
      "Nothing, a shared Artifact is reachable only by the people you send it to",
      "Swap the real prices for made-up ones before you share it",
      "Leave the real prices in and write a confidentiality note at the top of the page",
      "Share it with only the two colleagues who actually need it",
    ],
    correct: 2,
    explanation:
      "Sharing is the step that changes who can see something. On our plan a shared Artifact opens for anyone at Phlo with the link, not just the people you had in mind, and it carries the files attached to the conversation that built it. Plenty of those people have no business seeing supplier pricing, so live figures are the wrong thing to leave in. A confidentiality note changes nothing about who can open the page, asking colleagues not to forward a link is not a control, and you cannot narrow a share to two names. It is everyone at Phlo or nobody.",
  },
  {
    day: 9,
    question:
      "Which of these is the strongest candidate for Cowork rather than an ordinary Chat?",
    options: [
      "A question you need a single short answer to before this afternoon",
      "Drafting an email to a supplier about a late delivery",
      "Deciding which of two suppliers your team should move to",
      "Working through a live document with a colleague at the same time",
      "Merging six monthly reports into one summary and filing them",
    ],
    correct: 4,
    explanation:
      "Cowork earns its keep on assembly across a lot of files on your own machine. The work is tedious instead of difficult, and it ends in files instead of an answer. A short question and a draft are ordinary chat, deciding is yours, and two people cannot work in one Cowork session, so anything live and shared belongs elsewhere.",
  },
  {
    day: 9,
    question:
      "You are handing a job to Cowork in the desktop app and you have skipped the permission prompts so it can work without stopping to ask. What is keeping it away from files it has no business opening?",
    options: [
      "The folder you pointed it at, and whatever you chose to put in it",
      "Claude's judgement about which of your files the task actually needs",
      "The one-sentence brief, which tells it what it is allowed to open",
      "The desktop app, which reaches your Claude account rather than your disk",
      "Nothing much, so read every file it touched once the run has finished",
    ],
    correct: 0,
    explanation:
      "Skipping the prompts is what makes the folder the control. There is no per-step approval left, so the only thing between Cowork and a file is whether you put that file in scope before the run started. Claude has no way of knowing which of your documents are commercially sensitive. A brief describes the goal, it does not grant access. The desktop app is the route to your disk, not a limit on it: on our plan the run happens on Anthropic's servers and reaches your files through that app, for the folders you connected and no others. Reading afterwards is worth doing, but by then it has already opened whatever was there.",
  },
  {
    day: 10,
    question:
      "You need a pitch deck for Monday and you want to shape the layout before it goes out. Where does Claude Design earn its place over an ordinary Chat?",
    options: [
      "It writes the words on each slide more accurately than a Chat does",
      "It signs the deck off, so nobody else has to review what it made",
      "It keeps the deck's source documents attached for the next revision",
      "You shape the layout on a canvas and export the result as a PPTX",
      "It is the only surface at Phlo that can read a PowerPoint file",
    ],
    correct: 3,
    explanation:
      "You get a canvas and a real export. You adjust spacing, colour and layout yourself, or ask for changes in plain English, and the Export button gives you PowerPoint, PDF or a standalone page. A Chat can draft the words, but hands them back as text for you to reassemble. Keeping the source documents for next time is what a Project is for. Nothing here removes the human review, and a Chat reads a PowerPoint file perfectly well.",
  },
  {
    day: 10,
    question:
      "Which of the following is the poorest fit for Claude Design as it stands today?",
    options: [
      "An internal one-pager explaining a process change to your team",
      "A rough settings screen, made to get a conversation started",
      "A patient-facing leaflet going out under Phlo's brand",
      "A slide for Monday's team meeting that you will talk over",
      "A layout you want to react to before committing real time to it",
    ],
    correct: 2,
    explanation:
      "Two things make it the wrong fit. It is a research preview, so what comes out is a draft, and patient-facing material has to meet a standard a draft is not aiming at. Confidential designs and private code stay out for the same reason. Internal drafts, rough screens and something to react to are exactly what it is for.",
  },
];

/* ------------------------------------------------------------------ */
/* Week 3 - day 15. Ten questions, pass 8. Gates completion (G4).      */
/* Curriculum days 11-15, plus one spiral from each earlier week.      */
/* ------------------------------------------------------------------ */


export const WEEK_3_QUESTIONS: QuizQuestion[] = [
  {
    day: 11,
    question:
      "You want to show a colleague the screen you keep describing in meetings. What does Claude Design hand you that a written spec does not?",
    options: [
      "A wireframe they can click through, share and comment on",
      "A promise that what gets built will match what you asked for",
      "A finished screen, signed off and ready for patients to use",
      "A specification a developer can build from without changes",
      "A record of the meetings where the screen was first discussed",
    ],
    correct: 0,
    explanation:
      "What comes back is the thing itself, not a description of it: a prototype you can walk somebody through, share for comments, export as a PNG or a page, or hand to Claude Code to build. It is a quick draft. It is not a sign-off and it does not replace the build, so take it somewhere and use it.",
  },
  {
    day: 11,
    question:
      "Your first prototype comes back looking generic, as though it could be any company's screen. What is most likely missing from the prompt?",
    options: [
      "A longer description of the colours and fonts you would prefer",
      "The name of a competitor whose screen you want it to resemble",
      "A shorter prompt, since the detail is what made it generic",
      "The document you already have, attached as what to build from",
      "A request for something original rather than a template",
    ],
    correct: 3,
    explanation:
      "A prototype is only as specific as what you gave it. The spec, brief or page of notes you already have is what turns any company's screen into yours. Styling instructions only polish something generic, copying a competitor borrows their thinking, and cutting detail is the opposite of the fix. Ask for three versions while you are there. Choosing between three is quicker than describing one.",
  },
  {
    day: 12,
    question:
      "The Word extension is open on a document your manager has already been through. How should you ask for the rewrite?",
    options: [
      "As tracked changes, so each edit is accepted or rejected",
      "As a clean copy, then compare the two documents by eye",
      "In a chat, by pasting the document in and working there",
      "As a list of edits for you to apply to the file yourself",
      "As a rewritten file, keeping the original as a backup copy",
    ],
    correct: 0,
    explanation:
      "Tracked changes puts the edit in the real document and lets you accept it line by line. The comments are the other half of the job: ask Claude to summarise them and point out where they disagree, instead of reading twenty of them yourself. Every other option leaves you reconciling two documents by hand, which is the work the extension is there to remove.",
  },
  {
    day: 12,
    question:
      "You ask the PowerPoint extension to tighten three slides you have selected, on a deck that goes out this afternoon. Which choice matters most before you run it?",
    options: [
      "Whether extended thinking is turned on for the request",
      "Whether the deck is saved to OneDrive rather than locally",
      "Whether it asks before each edit or applies them all",
      "Whether the other Office extensions are installed as well",
      "Whether the slides are on the current brand template",
    ],
    correct: 2,
    explanation:
      "The extension edits the real file, so the setting that changes what you end up with is whether you see each edit before it lands. Extended thinking changes how long Claude reasons, not what it is allowed to do, and where the file is saved changes nothing. Select the slides you want changed first. It is better at tidying up what is there than at building a deck from nothing.",
  },
  {
    day: 13,
    question:
      "You inherit a pricing workbook nobody documented and one assumption has to change. What does the Excel extension give you that a chat does not?",
    options: [
      "A guarantee the model is right once it has finished with it",
      "Answers about any cell, and the change made in the live file",
      "A rebuild of the workbook from scratch, without the original",
      "A search across the other workbooks saved on your drive",
      "A record of every change made, kept for whoever audits it",
    ],
    correct: 1,
    explanation:
      "It works on the workbook that is open, so you can ask what a cell is doing, change an assumption and have the formulas updated in place, instead of pasting fragments into a chat and typing the answers back. It cannot reach a file you have not opened. It does not make the model right either. It writes into your file, so a wrong answer is a wrong number where it counts. Tell it how the sheet is built, then check what it changed.",
  },
  {
    day: 14,
    question:
      "The Outlook extension triages your inbox and hands you a reply with the recipients and subject already filled in. What is still yours?",
    options: [
      "Deciding which folder each message should be filed into",
      "Choosing which colleagues are allowed to see the thread",
      "Reading the draft before it goes out under your name",
      "Telling it which mail arrived while you were away",
      "Setting the hours in which it may sort your inbox for you",
    ],
    correct: 2,
    explanation:
      "Triage sorts the inbox into what needs you, what it can draft and what is noise, and the drafts arrive ready to send. That is exactly why you read one before it goes. It is a public beta, it works on the message in front of it, and an email sent in your name is yours, whoever wrote the first version.",
  },
  {
    day: 15,
    question:
      "You are totalling up what the three weeks saved you. For the job you claim the biggest saving on, the before figure and the after figure are both ones you remembered. What is the problem?",
    options: [
      "Nothing is wrong, you ran the job both ways so both figures are yours",
      "The before figure will be inflated, because slow work feels longer",
      "Neither figure was measured, so the saving is a guess with a decimal",
      "The saving belongs to the team rather than to you, so it double counts",
      "Three weeks is too short a window to draw any saving from at all",
    ],
    correct: 2,
    explanation:
      "Remembered numbers drift in the direction you want them to go, and the before figure drifts furthest, because the old way is the one you resented. One timed run is worth more than fifteen estimates. It is also the only version of the figure that survives somebody outside the programme asking how you got it.",
  },
  {
    day: 15,
    question:
      "You have halved the time your weekly report takes by drafting it in a Chat. You now spend ten minutes checking figures you used to take straight from the system. How should that land in your total?",
    options: [
      "Leave it out, checking is overhead rather than part of the job",
      "Subtract it, because the job is not finished until it is checked",
      "Count it separately, as a cost of Claude rather than a cost of the job",
      "Ignore it, the checking tails off once the drafting has earned trust",
      "Halve it, since you would have checked some of those figures anyway",
    ],
    correct: 1,
    explanation:
      "The number worth having is the one you could defend to somebody outside the programme, and that means the job end to end, not the drafting step on its own. Checking is not overhead bolted onto the work, it is the part that makes the output usable. A total that quietly leaves it out falls apart the first time anyone asks how it was built.",
  },
  {
    day: 5,
    question:
      "Your team has a Project full of reference documents and a Connector to the system those documents describe. When does the Connector earn its keep?",
    options: [
      "When you need what the system says now, not what it said then",
      "Always, because a Connector is the more capable feature of the two",
      "Only once the Project grows too large to search reliably",
      "Never, since the two of them do the same job by other means",
      "When the documents in the Project are more than a month old",
    ],
    correct: 0,
    explanation:
      "A Project holds background that changes slowly. A Connector fetches live state. Reference material belongs in the Project, and anything that moves belongs behind the Connector, whatever its age. A document goes stale when the system changes, not after a set number of weeks, and treating a stored document as current is a quiet source of wrong answers.",
  },
  {
    day: 7,
    question:
      "You have a recurring task, a one-off question, a method colleagues should reuse and a system Claude cannot reach. Which mapping is right?",
    options: [
      "Skill, Scheduled Task, Project, Connector",
      "Project, Skill, Connector, Artifact",
      "Scheduled Task, Chat, Skill, Connector",
      "Connector, Artifact, Scheduled Task, Skill",
      "Scheduled Task, Chat, Project, Connector",
    ],
    correct: 2,
    explanation:
      "Recurring and predictable is a Scheduled Task, a one-off just needs a Chat, a method other people can run is a Skill, and reaching a system is a Connector. The near miss puts a Project in the third slot. A Project holds background for your own chats, it does not package a method somebody else's chat can trigger. Picking the wrong container is what makes simple work feel like hard work.",
  },
];

export const QUIZ_CONTENT_BY_DAY: Record<number, QuizQuestion[]> = {
  5: WEEK_1_QUESTIONS,
  10: WEEK_2_QUESTIONS,
  15: WEEK_3_QUESTIONS,
};
