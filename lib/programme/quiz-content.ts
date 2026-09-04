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
      "You ask for the current list price of a product line and get a precise figure, to the penny. Where did that number actually come from?",
    options: [
      "It looked the price up and reported what it found",
      "It reported the last value it saw, so it is right unless the price has moved recently",
      "It calculated it from related figures it does hold",
      "It predicted a plausible continuation from patterns in its training data, so the precision is a property of the writing rather than of any source",
      "It inferred it from your earlier messages, so it is right if those were",
    ],
    correct: 3,
    explanation:
      "Nothing was retrieved. It predicts what comes next, so a figure arrives in whatever shape the surrounding prose calls for, and two decimal places is a writing habit rather than evidence. When the number is right, that is the training data agreeing with reality rather than a lookup. Anything that moves needs a Connector or a source you open yourself.",
  },
  {
    day: 1,
    question:
      "Two hours into a long working session, Claude starts breaking a formatting rule you set at the start and had been following all morning. What is the likeliest cause?",
    options: [
      "It has decided your later instructions override the earlier one",
      "The conversation has outgrown what it can hold at once, so the opening instructions are no longer in view",
      "Its training data disagrees with your rule",
      "Output quality degrades over a long session, so it needs restarting periodically",
      "The rule was not stated firmly enough to stick",
    ],
    correct: 1,
    explanation:
      "Everything it can see has to fit in one window, and a long conversation pushes the beginning of it out of range. Restating the rule, or carrying the essentials into a fresh chat, fixes it. Saying it more firmly does not, because the instruction is not being defied, it is not being seen.",
  },
  {
    day: 2,
    question:
      "Which of these is the weakest candidate for handing to Claude?",
    options: [
      "Drafting the first version of a recurring internal update",
      "Summarising a long supplier contract you will read properly afterwards",
      "Signing off the final numbers in the month-end pack",
      "Reformatting a messy stock export into a consistent structure",
      "Drafting the rejection letter for an unsuccessful tender, for a manager to review and send",
    ],
    correct: 2,
    explanation:
      "Drafting, summarising and reformatting are where it earns its keep, and an awkward subject does not change that while a named person reviews and sends. Signing off is the one that cannot move, because accountability is not a task. Use it to prepare what informs the decision rather than to make it.",
  },
  {
    day: 2,
    question:
      "Two colleagues use the same tool on similar work. One handed over whole processes and is disappointed. The other handed over parts and is not. What best explains the gap?",
    options: [
      "The first is delegating the judgement and the accountability, which do not transfer, rather than the blank page and the repetition, which do",
      "The second writes better prompts",
      "The first is working on more complex material",
      "The second has simply been using it for longer",
      "The first needs a Project and the second already has one",
    ],
    correct: 0,
    explanation:
      "Complexity is not the dividing line and neither is fluency with the tool. What transfers is the drafting and the grind. What does not is deciding and owning the result, so a process handed over whole always disappoints at the point where somebody has to be answerable. Prompting and Projects both help, and neither moves that line.",
  },
  {
    day: 3,
    question:
      "A prompt returns content that is accurate and complete but reads like a different company wrote it. Which part of CRISPE is missing?",
    options: [
      "Context",
      "Instructions",
      "Parameters",
      "Role",
      "Style",
    ],
    correct: 4,
    explanation:
      "Style is tone, register and voice. The content being right tells you Context and Instructions did their job. Role changes the expertise it writes from rather than the voice it writes in, and Parameters constrain length, format and what to leave out. When output is correct but reads wrong, Style is the gap.",
  },
  {
    day: 3,
    question:
      "You need a report laid out exactly like last quarter's, down to the section order and the way the variances are phrased. Which part of CRISPE does most of the work?",
    options: [
      "Instructions, listing every formatting rule you can think of",
      "Example, because pasting last quarter's report carries the shape, the order and the phrasing at once",
      "Parameters, specifying the length and the section count",
      "Context, explaining who reads the report and why",
      "Role, so it writes as the analyst who produced the original",
    ],
    correct: 1,
    explanation:
      "One example carries more specification than a page of rules, and it removes the ambiguity a description always leaves behind. Parameters and Instructions can approximate the shape and never the phrasing. Role and Context change how it thinks rather than what it hands you.",
  },
  {
    day: 4,
    question:
      "Every week you re-explain the same background before you can ask your actual question: your team's terminology, the format you need and the standing constraints. What fixes it properly?",
    options: [
      "Keep the preamble in a note and paste it at the top of each chat",
      "Write one much longer prompt so nothing gets missed",
      "Ask Claude to remember it at the end of each chat",
      "Put the background and the reference documents in a Project, and start those chats inside it",
      "Add a Connector to the systems that background describes",
    ],
    correct: 3,
    explanation:
      "A Project holds standing context, so every chat inside it starts briefed and nobody maintains a preamble by hand. A pasted note drifts the moment the format changes and a longer prompt moves the repetition rather than removing it. A Connector fetches live state, which is a different problem from standing background.",
  },
  {
    day: 4,
    question:
      "A Project you built answers the exact question you built it around very well, and anything slightly different badly. What does that tell you?",
    options: [
      "The knowledge files are too small",
      "Projects are not meant for varied work",
      "The instructions describe one task rather than how your team works, so there is nothing to generalise from",
      "You need a separate Project for each question",
      "The request has to be phrased the way you phrased the original",
    ],
    correct: 2,
    explanation:
      "A Project that only answers its founding question is a saved prompt with extra steps. Standing context is the method, the vocabulary and the constraints, and those carry across requests. Splitting it per question multiplies what you maintain and teaches the same lesson again a month later.",
  },
  {
    day: 5,
    question:
      "You pull the same figures out of the same system into Claude several times a day. What is that a signal for?",
    options: [
      "A Connector, so it reaches the system and you stop ferrying context by hand",
      "A longer prompt that includes more of the background",
      "A Project holding the latest export of those figures",
      "Nothing, copy and paste is fine at that volume",
      "A Scheduled Task that pastes the figures in for you each morning",
    ],
    correct: 0,
    explanation:
      "Repetitive copy and paste is the clearest signal a Connector pays for itself. A Project holds context that changes slowly, and an export dropped into one is stale the moment it is saved. A schedule automates the ferrying rather than removing it, which leaves you the same stale figures on a timer.",
  },
  {
    day: 5,
    question:
      "A colleague worries that connecting a system to Claude will expose data they are not cleared to see. What is the accurate answer?",
    options: [
      "They are right, a Connector reads the system directly and bypasses its permissions",
      "Connectors only ever read data that is already public",
      "It depends entirely on which Connector it is",
      "It is safe as long as they enable only the permissions the job actually needs",
      "A Connector acts within the access they already have, so it cannot surface anything they could not open themselves",
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
      "Claude gives you a confident, well-written answer about a courier's cut-off times, with specific figures. You do not know the terms yourself. What is the habit to build?",
    options: [
      "Accept it, since that level of detail suggests it came from real data",
      "Ask whether it is sure, and accept the answer if it holds",
      "Check the specifics against the actual source before you act on them or pass them on",
      "Ask again in a fresh chat and accept it if the two answers agree",
      "Accept it for internal planning and check only before anything goes to the courier",
    ],
    correct: 2,
    explanation:
      "Fluency is not accuracy and confidence is not evidence. Anything specific and consequential gets checked against the source. Internal decisions are made on those figures too, so the internal exemption is exactly where a wrong number gets established as fact. In the May baseline most people rated themselves confident at catching wrong answers, which is the blind spot this day exists for.",
  },
  {
    day: 6,
    question:
      "Why is asking Claude whether it is sure a weak verification method?",
    options: [
      "It takes too long to be worth doing",
      "It tests whether the answer is consistent, not whether it is true, and a wrong answer can be perfectly consistent",
      "It always says yes",
      "It only works on factual questions",
      "It works, but only if you ask before it has committed to an answer",
    ],
    correct: 1,
    explanation:
      "A self-check measures consistency. A model will restate a wrong answer with total conviction, and rephrasing usually returns a variation on the same misunderstanding rather than a correction. Timing does not rescue it either, because the problem is the method rather than the moment. Verification means going outside the conversation.",
  },
  {
    day: 7,
    question:
      "You need a written comparison of three couriers' terms, ready to send to your manager. Which approach uses what the tool is actually good at?",
    options: [
      "Ask for the comparison and copy the answer out of the chat by hand",
      "Ask three separate questions and stitch the answers together yourself",
      "Ask for bullet points and write them up yourself",
      "Ask it to research all three and hand back the finished document as a file",
      "Ask for the comparison, then paste it into a document and format it",
    ],
    correct: 3,
    explanation:
      "It can produce the finished file rather than leaving you to reassemble a document out of chat text, and Research runs in the background while you do something else. Every other option ends with you doing the part the tool would have done, and pasting then formatting is that same work with an extra step in front of it.",
  },
  {
    day: 7,
    question:
      "You turn Memory on and it starts carrying your role, your team's terminology and your usual formats between chats. What does that change, and what does it not?",
    options: [
      "Factual answers get more reliable, because it knows more about your situation",
      "You stop re-establishing who you are and how you work, and nothing about checking the output changes",
      "It can now reach your company systems without a Connector",
      "Your chats become visible to colleagues who share the same memory",
      "It stops inventing detail on topics it now holds context for",
    ],
    correct: 1,
    explanation:
      "Memory removes the re-briefing. It does not turn a prediction into a lookup, so the checking habit is untouched, and knowing your team's vocabulary does not stop it inventing a figure. It grants no system access, which is what a Connector is for, and it shares nothing with anyone.",
  },
  {
    day: 8,
    question:
      "Which of these is the strongest candidate for Cowork rather than an ordinary chat?",
    options: [
      "A question you need answered in one line",
      "Drafting an email to a supplier",
      "Deciding which of two suppliers to move to",
      "Researching a market and writing it up",
      "Merging six monthly reports into one summary, then renaming and filing the source files",
    ],
    correct: 4,
    explanation:
      "Cowork earns its keep on assembly across many files on your own machine: work that is tedious rather than difficult, and that ends in files rather than in an answer. A one-line question and a draft are ordinary chat, deciding is yours to own and a market write-up is Research, which needs sources rather than your file system.",
  },
  {
    day: 8,
    question:
      "You have handed Cowork a whole goal in one sentence and it is working. Where does your attention belong?",
    options: [
      "On each step, approving it before the next one starts",
      "On the prompt, refining it while the run continues",
      "On watching closely enough to stop it if it heads somewhere wrong, then reading the deliverable properly before it goes anywhere",
      "Nowhere until it finishes, since steering it defeats the point",
      "On the folder, in case it writes outside the scope you set",
    ],
    correct: 2,
    explanation:
      "Handing over the goal is the point, so approving every step is just driving again. But it did the assembly and you still own the call, so an unread deliverable is the failure this day exists to prevent. Watching without steering is the balance. The folder was scoped before the run started rather than policed during it.",
  },
  {
    day: 9,
    question:
      "You have a reliable method for a recurring task and two colleagues want it. You could write it as a Skill, put it in a Project or keep it as a saved prompt. What makes a Skill the right container?",
    options: [
      "It packages the method so it fires on its own when the job comes up, in anybody's chat",
      "It stores the documents the task needs alongside the method",
      "It runs the task automatically each morning",
      "It gives Claude access to the system the task uses",
      "It keeps the method private to the people you name",
    ],
    correct: 0,
    explanation:
      "A Skill turns how you do something into something repeatable that other people's chats can reach, and its description is what makes it fire without being named. Documents are a Project, a timetable is a Scheduled Task and system access is a Connector. Choosing the wrong container is what makes simple work feel like overhead.",
  },
  {
    day: 9,
    question:
      "You built a Skill and it never fires unless you name it explicitly. What is almost always wrong?",
    options: [
      "The instructions inside it are too long",
      "It has to be shared with your team before it will trigger",
      "The task is too specific for a Skill to be worth it",
      "The description is too vague to match a real request, so nothing recognises when to use it",
      "Skills only fire for the person who created them",
    ],
    correct: 3,
    explanation:
      "The description is the trigger. Use this when formatting a monthly performance report fires when it should, and helps with reports never fires at all. Sharing changes who can reach it rather than whether it triggers, and a narrow task is exactly what a Skill wants.",
  },
  {
    day: 10,
    question:
      "You schedule the Monday stock summary for 07:00. You reach your desk at 08:30 and your laptop is shut overnight. What happens?",
    options: [
      "It runs when you open the laptop, so the result arrives later than you planned",
      "It runs at 07:00 on the server and the result is waiting for you",
      "It is skipped and runs the following Monday instead",
      "It fails and you are notified",
      "It runs at 07:00 but cannot use any Connectors until you sign in",
    ],
    correct: 0,
    explanation:
      "A scheduled task runs on your machine while it is awake and the desktop app is open, so a shut laptop defers the run rather than cancelling it. Pick a time you are genuinely at your desk. Nothing is skipped and nothing fails, which is precisely why a badly timed schedule is easy not to notice.",
  },
  {
    day: 10,
    question:
      "A Scheduled Task you set up three weeks ago still runs, but you now rewrite most of its output before using it. What should you do?",
    options: [
      "Leave it, it is still saving time overall",
      "Delete it and go back to doing the task by hand",
      "Run it more often so the output stays current",
      "Keep it and log the saving as the full time the task used to take",
      "Look at what you keep changing and fold that back into the task, or retire it if the work has moved on",
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
      "You have reworded a prompt four times and keep getting the same shape of wrong answer. What does that pattern tell you, and what do you do about it?",
    options: [
      "The wording is still not precise enough, so keep refining it",
      "The misunderstanding sits upstream of the wording, so ask what it needs from you and answer that",
      "The task is beyond the tool, so do it yourself",
      "Start a fresh chat and ask the same thing again",
      "Keep adding context until something shifts",
    ],
    correct: 1,
    explanation:
      "One poor answer is normal and a follow-up is just conversation. The same wrong shape repeating means the gap is in what you have not said rather than in how you said it, and no rewrite reaches that. Letting it interview you surfaces the context you did not realise you were assuming. Adding context blindly is the same guess with more words.",
  },
  {
    day: 12,
    question:
      "You have asked for a checklist your team will use every week. Why ask for it as an Artifact rather than as chat text?",
    options: [
      "It gets generated faster",
      "Artifacts are more accurate than chat answers",
      "You get a self-contained thing you can refine, version and publish, so it survives the conversation and colleagues can use it without reading the chat",
      "It uses fewer messages",
      "Anyone you share it with can edit your copy directly",
    ],
    correct: 2,
    explanation:
      "An Artifact is the output as an object rather than as scrollback: edited in place, every version kept, and shareable to people who need the checklist rather than the conversation behind it. Speed and accuracy are unchanged. Publishing lets other people open and use it, which is not the same as handing them edit rights on yours.",
  },
  {
    day: 13,
    question:
      "You need a one-page summary for the exec team and you are working in Claude Design. Where does the help genuinely apply?",
    options: [
      "It removes the need for anyone with design skills",
      "It guarantees the result is on brand",
      "It only matters for customer-facing material",
      "It gets you to a presentable first version quickly, which you then judge and refine",
      "It produces a finished asset you can send without review",
    ],
    correct: 3,
    explanation:
      "The gain is the distance from a blank page to something worth reacting to, and a strong first draft that a person then shapes is the whole method. It is a research preview, so what comes out is a draft rather than a finished brand. Internal work benefits from clarity as much as customer-facing work does.",
  },
  {
    day: 14,
    question:
      "Claude keeps failing at a job. How do you tell a prompting problem from a capability problem, and why does the distinction matter?",
    options: [
      "It misunderstood what you meant is a prompting problem that better wording fixes; it cannot reach or cannot do that is a capability problem no rewrite reaches, so you add the Plugin instead",
      "By how long the job takes, since a slow job means it is straining against a limit",
      "It does not matter much, because better prompting helps in both cases",
      "By how confident the answer sounds, since a confident wrong answer means a capability gap",
      "Capability problems announce themselves with an error, so anything else is a prompting problem",
    ],
    correct: 0,
    explanation:
      "Prompting changes how well you use what is already there. Plugins change what is there. The diagnosis is where the time goes, because rewriting a prompt against a capability gap can absorb an afternoon and never work. Capability gaps rarely announce themselves, and a confident wrong answer is a verification problem rather than a capability one.",
  },
  {
    day: 15,
    question:
      "You spend most of your day in Excel and Slack. What follows from Claude being available inside them?",
    options: [
      "You should still do the work in the Claude app and paste the results across",
      "The in-tool versions are less capable, so avoid them for anything that matters",
      "It only matters for people who work mostly in documents",
      "It matters most for long tasks, since those are the ones worth setting up",
      "You can work where the work already is, which removes the switch that stops people bothering with small jobs",
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
      "45 minutes a week, which is what the task used to cost",
      "40 minutes a week, the old cost minus the new one",
      "Nothing, until it has run for a full quarter",
      "However long the automation took to build, spread across the year",
      "40 minutes a week, plus the time colleagues save by reusing it",
    ],
    correct: 1,
    explanation:
      "The saving is the difference, because something still has to be run and checked. Overstating it is the fastest way to lose trust in the whole exercise, and claiming other people's saving on your own log double counts it the moment they log it too. In the May baseline half of respondents could not put a number on their saving at all, and a defensible small number beats a vague large one.",
  },
  {
    day: 3,
    question:
      "A prompt keeps producing output that is accurate but consistently the wrong length and format for where it needs to go. Which part of CRISPE do you reach for?",
    options: [
      "Context",
      "Role",
      "Instructions",
      "Parameters",
      "Example",
    ],
    correct: 3,
    explanation:
      "Parameters are the constraints: length, format, structure and what to leave out. Context and Role shape what it knows and how it thinks, and Instructions say what to do rather than what shape to do it in. An Example would work too, and it costs you a document to paste; when the content is already right, Parameters is the smaller lever.",
  },
  {
    day: 5,
    question:
      "Your team has a Project full of reference documents and a Connector to the system those documents describe. When does the Connector earn its keep over the Project?",
    options: [
      "When you need what the system says right now, rather than what the documents said when they were written",
      "Always, since Connectors are the more capable feature",
      "Only once the Project gets too large to search reliably",
      "Never, they do the same job by different means",
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
      "Nothing, citations are exactly what you want to see",
      "Citations mean the answer took longer to produce",
      "They should have asked for more citations",
      "The citations may be invented, so the fix is to confirm the sources exist",
      "A citation shows a source was referenced, not that it says what the summary claims, so the specifics still need reading against the document",
    ],
    correct: 4,
    explanation:
      "Citations raise confidence more than they raise reliability. A reference can be entirely real and still not support the sentence attached to it, so confirming the source exists is not the check. Follow one and read it against the claim. Asking for more of them compounds the problem rather than solving it.",
  },
  {
    day: 10,
    question:
      "You have a recurring task, a one-off question, a method you want colleagues to reuse and a system Claude cannot currently reach. Which mapping is right?",
    options: [
      "Skill, Scheduled Task, Project, Connector",
      "Project, Skill, Connector, Plugin",
      "Scheduled Task, normal chat, Skill, Connector",
      "Connector, Artifact, Scheduled Task, Skill",
      "Scheduled Task, normal chat, Project, Connector",
    ],
    correct: 2,
    explanation:
      "Recurring and predictable is a Scheduled Task, a one-off just needs a chat, a repeatable method other people can run is a Skill and reaching a system is a Connector. The near miss puts a Project in the third slot: a Project holds standing context for your own chats rather than packaging a method somebody else's chat can trigger. Choosing the wrong container is what makes simple work feel like overhead.",
  },
];

export const QUIZ_CONTENT_BY_DAY: Record<number, QuizQuestion[]> = {
  5: WEEK_1_QUESTIONS,
  10: WEEK_2_QUESTIONS,
  15: WEEK_3_QUESTIONS,
};
