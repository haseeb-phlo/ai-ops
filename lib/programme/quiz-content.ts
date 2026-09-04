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
 *   Week 2 (day 10) - D6 catching confident wrong answers,
 *                     D7 Research/Memory/files out, D8 Cowork, D9 Skills,
 *                     D10 Scheduled Tasks
 *   Week 3 (day 15) - D11 Reverse Prompting, D12 Artifacts, D13 Design,
 *                     D14 Dispatch + Plugins, D15 Claude everywhere, plus a
 *                     spiral back over one day from each earlier week
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
 *   would reach for. Reading the consent screen carefully IS good practice,
 *   it is just not what makes a Connector safe.
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
      "You ask Claude in a Chat for the current list price of a product line, and it gives you a precise figure to the penny. Where did that number come from?",
    options: [
      "It looked the price up and reported back what it found",
      "It calculated it from related figures that it does hold",
      "It predicted a plausible figure from patterns in its training data",
      "It reported the last value it saw, so it is current unless the price moved",
      "It inferred it from your earlier messages in this Chat",
    ],
    correct: 2,
    explanation:
      "Nothing was looked up. Claude predicts what comes next, so a figure arrives in whatever shape the surrounding sentence calls for, and two decimal places is a writing habit rather than evidence. When the number is right, that is training data agreeing with reality. Anything that moves needs a Connector or a source you open yourself.",
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
      "Everything Claude can see has to fit in one window, and a long Chat pushes the beginning of it out of range. Restating the rule, or carrying the essentials into a fresh Chat, fixes it. Saying it more firmly does not, because the instruction is not being defied, it is not being seen.",
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
      "Drafting a tender rejection letter for a manager to review and send",
    ],
    correct: 2,
    explanation:
      "Drafting, summarising and reformatting are where Claude earns its keep, and an awkward subject does not change that while a named person reviews and sends. Signing off is the one that cannot move, because accountability is not a task. Use Claude to prepare what informs the decision rather than to make it.",
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
      "Complexity is not the dividing line and neither is fluency with the tool. What transfers is the blank page and the repetitive middle. What does not is deciding and owning the result, so a process handed over whole always disappoints at the point where somebody has to be answerable. Prompting and Projects both help, and neither moves that line.",
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
      "Style is tone, register and voice. The content being right tells you Context and Instructions did their job. Role changes the expertise Claude writes from rather than the voice it writes in, and Parameters constrain length, format and what to leave out. When output is correct but reads wrong, Style is the gap.",
  },
  {
    day: 3,
    question:
      "You need a report laid out exactly like last quarter's, down to the section order and the wording of the variance notes. Which part of CRISPE does most of the work?",
    options: [
      "Instructions, listing out every formatting rule you can think of first",
      "Example, pasting last quarter's report so it can copy the shape",
      "Parameters, specifying the length and the number of sections",
      "Context, explaining who reads this report and what they need",
      "Role, so it writes as the analyst who produced the original",
    ],
    correct: 1,
    explanation:
      "One example carries more specification than a page of rules, and it removes the ambiguity a description always leaves behind. Parameters and Instructions can approximate the shape and never the phrasing. Role and Context change how Claude thinks rather than what it hands you.",
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
      "A Project holds standing context, so every Chat inside it starts briefed and nobody maintains a preamble by hand. A pasted note drifts the moment the format changes and a longer prompt moves the repetition rather than removing it. A Connector fetches live state, which is a different problem from standing background.",
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
      "A Project that only answers its founding question is a saved prompt with extra steps. Standing context is the method, the vocabulary and the constraints, and those carry across requests. Splitting it per question multiplies what you maintain and teaches the same lesson again a month later.",
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
      "Repetitive copy and paste is the clearest signal that a Connector pays for itself. A Project holds context that changes slowly, and an export dropped into one is stale the moment it is saved. A schedule automates the ferrying rather than removing it, which leaves you the same stale figures on a timer.",
  },
  {
    day: 5,
    question:
      "A colleague worries that connecting a system to Claude will expose data they are not cleared to see. What is the accurate answer?",
    options: [
      "They are right, a Connector reads the system and bypasses its permissions",
      "Connectors are limited to data that the system already publishes openly",
      "It depends entirely on which Connector and which system it is",
      "It is safe provided they enable only the permissions the job needs",
      "A Connector works within the access they already have",
    ],
    correct: 4,
    explanation:
      "A Connector is a route rather than a promotion, so their existing access is the ceiling. Checking the permissions a Connector allows by default is good practice and the day's task asks for it, and it is still not what makes the answer safe. Worth being clear on in a regulated business, because the fear is common and it stops people using something useful.",
  },
];

/* ------------------------------------------------------------------ */
/* Week 2 - day 10. Ten questions, pass 8. Curriculum days 6-10.       */
/* ------------------------------------------------------------------ */


export const WEEK_2_QUESTIONS: QuizQuestion[] = [
  {
    day: 6,
    question:
      "Claude gives you a confident, well-written answer in a Chat about a courier's cut-off times, with specific figures. You do not know the terms yourself. What is the habit to build?",
    options: [
      "Accept it, since that much detail suggests it came from real data",
      "Ask whether it is sure, and accept the answer if it holds up",
      "Check the specifics against the source before acting on them",
      "Ask again in a fresh Chat and accept it if the answers agree",
      "Accept it internally and check only before it goes to the courier",
    ],
    correct: 2,
    explanation:
      "Fluency is not accuracy and confidence is not evidence. Anything specific and consequential gets checked against the source. Internal decisions are made on those figures too, so the internal exemption is exactly where a wrong number gets established as fact. In the May baseline most people rated themselves confident at catching wrong answers, which is the blind spot this day exists for.",
  },
  {
    day: 6,
    question:
      "Why is asking Claude whether it is sure a weak way to verify an answer?",
    options: [
      "It takes longer than simply opening the source and checking it would",
      "It tests whether the answer is consistent, not whether it is true",
      "Claude will always say yes when you ask it that question",
      "It only works on factual questions, not on judgement calls",
      "It works, but only if you ask before it commits to an answer",
    ],
    correct: 1,
    explanation:
      "A self-check measures consistency. Claude will restate a wrong answer with total conviction, and rephrasing usually returns a variation on the same misunderstanding rather than a correction. Timing does not rescue it either, because the problem is the method rather than the moment. Verification means going outside the conversation.",
  },
  {
    day: 7,
    question:
      "You need a written comparison of three couriers' terms, ready to send to your manager. Which approach uses what Claude is actually good at?",
    options: [
      "Ask for the comparison, then copy the answer out of the Chat by hand",
      "Ask three separate questions and stitch the answers together yourself",
      "Ask for bullet points in a Chat and write the document up yourself",
      "Ask Research to compare all three and hand back a finished file",
      "Ask for the comparison, paste it into a document and format it",
    ],
    correct: 3,
    explanation:
      "Research searches, reads and cross-references, then hands back the finished file rather than leaving you to reassemble a document out of Chat text, and it runs in the background while you do something else. Every other option ends with you doing the part the tool would have done.",
  },
  {
    day: 7,
    question:
      "You turn Memory on and Claude starts carrying your role, your team's terminology and your usual formats between Chats. What does that change?",
    options: [
      "Factual answers get more reliable, because it knows your situation",
      "You stop re-briefing it at the start of every Chat, nothing more",
      "It can now reach your company systems without needing a Connector",
      "Your Chats become visible to colleagues who share the same memory",
      "It stops inventing detail on topics it now holds context about",
    ],
    correct: 1,
    explanation:
      "Memory removes the re-briefing. It does not turn a prediction into a lookup, so the checking habit is untouched, and knowing your team's vocabulary does not stop Claude inventing a figure. It grants no system access, which is what a Connector is for, and it shares nothing with anyone.",
  },
  {
    day: 8,
    question:
      "Which of these is the strongest candidate for Cowork rather than an ordinary Chat?",
    options: [
      "A question you need a single short answer to before this afternoon",
      "Drafting an email to a supplier about a late delivery",
      "Deciding which of two suppliers your team should move to",
      "Researching a market and writing the findings up properly",
      "Merging six monthly reports into one summary and filing them",
    ],
    correct: 4,
    explanation:
      "Cowork earns its keep on assembly across many files on your own machine: work that is tedious rather than difficult, and that ends in files rather than in an answer. A short question and a draft are ordinary Chat, deciding is yours to own and a market write-up is Research, which needs sources rather than your file system.",
  },
  {
    day: 8,
    question:
      "You have given Cowork a whole goal in one sentence and it is working. Where does your attention belong?",
    options: [
      "On each step, approving it before the next one is allowed to start",
      "On the prompt, refining the wording while the run is still going",
      "On watching it closely enough to stop it, then reading what it made",
      "Nowhere until it finishes, because steering it defeats the point",
      "On the folder, in case it writes to files outside the scope you set",
    ],
    correct: 2,
    explanation:
      "Handing over the goal is the point, so approving every step is just driving again. But Cowork did the assembly and you still own the call, so an unread deliverable is the failure this day exists to prevent. Watching without steering is the balance. The folder was scoped before the run started rather than policed during it.",
  },
  {
    day: 9,
    question:
      "You have a reliable method for a recurring task and two colleagues want to use it. What makes a Skill the right home for it, rather than a Project or a saved prompt?",
    options: [
      "It fires on its own when the job comes up, in anybody's Chat",
      "It stores the documents the task needs alongside the method",
      "It runs the task automatically each morning without being asked",
      "It gives Claude access to the system that the task depends on",
      "It keeps the method private to the colleagues you name on it",
    ],
    correct: 0,
    explanation:
      "A Skill packages how you do something so other people's Chats can reach it, and its description is what makes it fire without being named. Documents are a Project, a timetable is a Scheduled Task and system access is a Connector. Choosing the wrong container is what makes simple work feel like overhead.",
  },
  {
    day: 9,
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
      "The description is the trigger. Use this when formatting a monthly performance report fires when it should, and helps with reports never fires at all. Sharing changes who can reach a Skill rather than whether it triggers, and a narrow task is exactly what a Skill wants.",
  },
  {
    day: 10,
    question:
      "You set a Scheduled Task to run the stock summary at 07:00 each Monday. You reach your desk at 08:30 and your laptop was shut overnight. What happens?",
    options: [
      "It runs when you open the laptop, so the result arrives late",
      "It runs at 07:00 on Anthropic's servers and waits for you",
      "It is skipped entirely and runs again the following Monday",
      "It fails, and you get a notification telling you that it failed",
      "It runs at 07:00 but cannot use Connectors until you sign in",
    ],
    correct: 0,
    explanation:
      "A Scheduled Task runs on your machine while it is awake and the desktop app is open, so a shut laptop defers the run rather than cancelling it. Pick a time you are genuinely at your desk. Nothing is skipped and nothing fails, which is precisely why a badly timed schedule is easy not to notice.",
  },
  {
    day: 10,
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
      "Heavy editing means the task and the real work have drifted apart, and what you keep rewriting is the specification. Running it more often just produces more to correct. Logging the old full cost is how a time saving becomes a number nobody believes, because the saving is what the job costs now against what it cost before.",
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
      "You have reworded a prompt four times and keep getting the same shape of wrong answer back. What does that tell you?",
    options: [
      "The wording is still not precise enough, so keep on refining it",
      "The gap is in what you have not said, so let it interview you",
      "The task is beyond what the tool can do, so do it yourself",
      "The Chat is confused, so start a fresh one and ask again",
      "It needs more context, so keep adding until something shifts",
    ],
    correct: 1,
    explanation:
      "One poor answer is normal and a follow-up is just conversation. The same wrong shape repeating means the gap is in what you have not said rather than in how you said it, and no rewrite reaches that. Asking Claude what it needs from you surfaces the context you did not realise you were assuming. Adding context blindly is the same guess with more words.",
  },
  {
    day: 12,
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
      "An Artifact is the output as an object rather than as Chat scrollback: refined in place, every version kept, and shareable to people who need the checklist rather than the conversation behind it. Speed and accuracy are unchanged. Publishing lets other people open and use it, which is not the same as handing them edit rights on yours.",
  },
  {
    day: 13,
    question:
      "You are making a one-page summary for the exec team in Claude Design. Where does the help genuinely apply?",
    options: [
      "It removes the need for anyone with real design skills",
      "It guarantees that what comes out is on brand for Phlo",
      "It only matters for customer-facing material, not internal",
      "It gets you to a presentable first draft you then refine",
      "It produces a finished asset you can send without review",
    ],
    correct: 3,
    explanation:
      "The gain is the distance from a blank page to something worth reacting to, and a strong first draft that a person then shapes is the whole method. It is a research preview, so what comes out is a draft rather than a finished brand. Internal work benefits from clarity as much as customer-facing work does.",
  },
  {
    day: 14,
    question:
      "Claude keeps failing at a job you have given it. How do you tell a prompting problem from a capability problem?",
    options: [
      "It misunderstood you is prompting; it cannot reach that is capability",
      "A slow job means it is straining against a limit, so capability",
      "A confident wrong answer means a capability gap rather than wording",
      "Capability problems always show an error, so anything else is wording",
      "It rarely matters, because better prompting helps in both cases",
    ],
    correct: 0,
    explanation:
      "Prompting changes how well you use what is already there. Plugins change what is there. The diagnosis is where the time goes, because rewriting a prompt against a capability gap can absorb an afternoon and never work. Capability gaps rarely announce themselves, and a confident wrong answer is a verification problem rather than a capability one.",
  },
  {
    day: 15,
    question:
      "You spend most of your day in Excel and Slack, and Claude is available inside both. What follows from that?",
    options: [
      "You should still work in the Claude app and paste results across",
      "The in-tool versions are weaker, so avoid them for real work",
      "It only matters for people who work mostly in documents",
      "It matters most for long tasks, which are worth setting up for",
      "Small jobs stop being worth skipping, because the switch is gone",
    ],
    correct: 4,
    explanation:
      "The barrier was rarely capability, it was friction. Stopping, switching app, re-explaining the context and pasting the answer back is enough to make anyone skip a two-minute job, and small jobs are where most of the saving quietly adds up. Long tasks were always worth the switch, so they are not where this changes anything.",
  },
  {
    day: 1,
    question:
      "You have automated a report that used to take 45 minutes a week. It now takes 5 minutes to run and check. What goes in the Time-Back Log?",
    options: [
      "45 minutes a week, which is what the task used to cost you",
      "40 minutes a week, the old cost minus the new one",
      "Nothing, until it has run reliably for a full quarter",
      "The time the automation took to build, spread over the year",
      "40 minutes, plus the time colleagues save by reusing it",
    ],
    correct: 1,
    explanation:
      "The saving is the difference, because something still has to be run and checked. Overstating it is the fastest way to lose trust in the whole exercise, and claiming other people's saving on your own log double counts it the moment they log it too. In the May baseline half of respondents could not put a number on their saving at all, and a defensible small number beats a vague large one.",
  },
  {
    day: 3,
    question:
      "A prompt keeps producing output that is accurate but consistently the wrong length and format for where it has to go. Which part of CRISPE do you reach for?",
    options: [
      "Context",
      "Role",
      "Instructions",
      "Parameters",
      "Example",
    ],
    correct: 3,
    explanation:
      "Parameters are the constraints: length, format, structure and what to leave out. Context and Role shape what Claude knows and how it thinks, and Instructions say what to do rather than what shape to do it in. An Example would work too, and it costs you a document to paste; when the content is already right, Parameters is the smaller lever.",
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
      "A Project holds standing context that changes slowly and a Connector fetches live state. Reference material belongs in the Project and anything that moves belongs behind the Connector, whatever its age: a document goes stale when the system changes rather than after a set period. Treating a stored document as current is a quiet source of wrong answers.",
  },
  {
    day: 6,
    question:
      "A colleague shares a Claude-drafted summary of a supplier agreement and says it is cited, so it is solid. What is the flaw?",
    options: [
      "Nothing, citations are exactly what you should be looking for",
      "Citations only mean the answer took longer to put together",
      "They should have asked Claude for more citations than that",
      "The citations may be invented, so confirm the sources exist",
      "A cited source may not say what the summary claims it says",
    ],
    correct: 4,
    explanation:
      "Citations raise confidence more than they raise reliability. A reference can be entirely real and still not support the sentence attached to it, so confirming the source exists is not the check. Follow one and read it against the claim. Asking for more of them compounds the problem rather than solving it.",
  },
  {
    day: 10,
    question:
      "You have a recurring task, a one-off question, a method colleagues should reuse and a system Claude cannot reach. Which mapping is right?",
    options: [
      "Skill, Scheduled Task, Project, Connector",
      "Project, Skill, Connector, Plugin",
      "Scheduled Task, Chat, Skill, Connector",
      "Connector, Artifact, Scheduled Task, Skill",
      "Scheduled Task, Chat, Project, Connector",
    ],
    correct: 2,
    explanation:
      "Recurring and predictable is a Scheduled Task, a one-off just needs a Chat, a repeatable method other people can run is a Skill and reaching a system is a Connector. The near miss puts a Project in the third slot: a Project holds standing context for your own Chats rather than packaging a method somebody else's Chat can trigger. Choosing the wrong container is what makes simple work feel like overhead.",
  },
];

export const QUIZ_CONTENT_BY_DAY: Record<number, QuizQuestion[]> = {
  5: WEEK_1_QUESTIONS,
  10: WEEK_2_QUESTIONS,
  15: WEEK_3_QUESTIONS,
};
