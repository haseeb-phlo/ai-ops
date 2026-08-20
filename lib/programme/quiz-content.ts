/**
 * Knowledge-check questions for the three weekly quizzes.
 *
 * Drawn from the 15-day curriculum in "Phlo AI Training Programme v5":
 *   Week 1 (day 5)  - D1 when to use AI, D2 CRISP, D3 Connectors & MCP,
 *                     D4 Projects, D5 catching confident wrong answers
 *   Week 2 (day 10) - D6 Research/Memory/files out, D7 Cowork, D8 Skills,
 *                     D9 Scheduled Tasks, D10 Reverse Prompting
 *   Week 3 (day 15) - D11 Artifacts, D12 Design, D13 Dispatch + Plugins,
 *                     D14 Claude everywhere, D15 choosing the right tool,
 *                     plus a spiral back over weeks 1-2
 *
 * Design notes, so edits keep the character:
 *
 * - SCENARIOS, not definitions. "What is a Project?" tests reading; "you're
 *   about to do X, what's the better move?" tests judgement, which is what the
 *   programme is actually for.
 * - Every distractor is something a reasonable person might genuinely pick.
 *   Obvious throwaway options make a quiz feel like a formality.
 * - Set at Phlo: dispensary, patient care, prescribing, governance, finance.
 * - NOTHING here asks the learner to make a clinical decision. Where a
 *   scenario touches clinical ground, the correct answer is always to route it
 *   to the qualified human - which is both the right answer and the habit
 *   worth drilling in a regulated pharmacy.
 * - Explanations say WHY the wrong answers are wrong, because the explanation
 *   is shown after answering and is where most of the learning lands.
 */

export type QuizQuestion = {
  question: string;
  options: [string, string, string, string];
  /** Index into `options`. */
  correct: 0 | 1 | 2 | 3;
  explanation: string;
  /** Curriculum day this draws on, for editing against the video library. */
  day: number;
};

/* ------------------------------------------------------------------ */
/* Week 1 - day 5. Five questions, pass 4.                             */
/* ------------------------------------------------------------------ */

export const WEEK_1_QUESTIONS: QuizQuestion[] = [
  {
    day: 1,
    question:
      "A patient messages Patient Care asking whether they can take a new over-the-counter medicine alongside their current prescription. You want to reply quickly. What's the right use of Claude here?",
    options: [
      "Ask Claude the interaction question and send its answer if it reads sensibly",
      "Ask Claude to draft the reply's structure and tone, but have a pharmacist confirm the clinical content before it goes out",
      "Don't involve Claude at all — anything touching a patient is off-limits",
      "Ask Claude, then add a line saying the advice was AI-generated",
    ],
    correct: 1,
    explanation:
      "Claude is genuinely good at structure, tone and speed; it is not the accountable party for clinical advice, and a disclaimer doesn't transfer that accountability. Nor is the answer to avoid AI entirely — that gives up the real time saving on drafting. Use it for the draft, keep the qualified human on the clinical call.",
  },
  {
    day: 2,
    question:
      "Two colleagues ask Claude for the same thing. One types \"write something about our stock process\". The other explains who they are, what the document is for, who will read it, and gives last quarter's report as an example to match. Why does the second one usually get a usable answer first time?",
    options: [
      "Longer prompts always produce better output",
      "It supplied context, a clear task, and an example of what \"good\" looks like — so Claude isn't guessing at the job",
      "Claude gives priority to more detailed requests",
      "The second person is using a more capable model",
    ],
    correct: 1,
    explanation:
      "It isn't length — a long, vague prompt is still vague. What changed is that the ambiguity was removed: who it's for, what it's for, and a concrete example to match. Same model, same effort, far less back-and-forth.",
  },
  {
    day: 3,
    question:
      "You keep pasting the same figures out of a system into Claude, several times a day. What are Connectors for?",
    options: [
      "Letting Claude reach that system directly, so you stop copying and pasting the context in by hand",
      "Making Claude respond faster",
      "Connecting two different AI tools together",
      "Sharing your chats with your team",
    ],
    correct: 0,
    explanation:
      "A Connector gives Claude a live route to a tool you already use, so the context comes to it instead of you ferrying it across. Repetitive copy-paste is the clearest signal that a Connector would pay for itself — and it was the single biggest awareness gap in the May baseline.",
  },
  {
    day: 4,
    question:
      "Every week you re-explain the same background — your team's terminology, the format you need, the standing constraints — before you can ask the actual question. What fixes that?",
    options: [
      "Save your prompt in a note and paste it each time",
      "Put the background and reference documents into a Project, and start those chats inside it",
      "Ask Claude to remember it at the end of each chat",
      "Use a longer prompt so nothing is missed",
    ],
    correct: 1,
    explanation:
      "A Project holds the standing context — documents, terminology, house style — so every chat inside it starts already briefed. Pasting from a note works but you maintain it by hand and it drifts; a longer prompt just moves the repetition rather than removing it.",
  },
  {
    day: 5,
    question:
      "Claude gives you a confident, well-written answer about a supplier's returns terms, with specific figures. You don't know the terms yourself. What's the habit to build?",
    options: [
      "Accept it — the detail and confidence suggest it's drawn from real data",
      "Check the specifics against the actual source before you act on or forward them",
      "Ask Claude \"are you sure?\" and accept the answer if it holds",
      "Rephrase the question and accept it if you get the same answer twice",
    ],
    correct: 1,
    explanation:
      "Fluency is not accuracy, and confidence is not evidence. Asking \"are you sure?\" or repeating the question tests consistency, not truth — a model can be consistently wrong. Anything specific and consequential gets checked against the source. In the May baseline most people rated themselves confident at catching wrong answers, which is exactly the blind spot this day is for.",
  },
];

/* ------------------------------------------------------------------ */
/* Week 2 - day 10. Five questions, pass 4.                            */
/* ------------------------------------------------------------------ */

export const WEEK_2_QUESTIONS: QuizQuestion[] = [
  {
    day: 6,
    question:
      "You need a written summary of how three suppliers' terms compare, ready to send on. Which approach fits what Claude is actually good at?",
    options: [
      "Ask for the comparison and copy the answer out of the chat by hand",
      "Ask it to research the comparison and produce the finished document as a file you can send on",
      "Ask three separate questions and stitch the answers together yourself",
      "Ask for bullet points, then rewrite them into prose yourself",
    ],
    correct: 1,
    explanation:
      "Claude can do the research and hand back a finished file, rather than leaving you to reassemble a document out of chat text. The other options all end with you doing the part the tool would have done — which is where most of the unclaimed time saving sits.",
  },
  {
    day: 7,
    question:
      "A task takes eight steps across two systems and takes you most of a morning. What does working with Claude on it look like, versus a one-off question?",
    options: [
      "Ask one very detailed prompt covering all eight steps at once",
      "Work through it together — Claude does a step, you check it, then it moves on — so mistakes surface at step two rather than step eight",
      "Do the task yourself and ask Claude to check it afterwards",
      "Split it into eight separate chats to keep each one simple",
    ],
    correct: 1,
    explanation:
      "For multi-step work the value is in the loop, not the single answer. Checking as you go catches a wrong turn while it's cheap. One giant prompt hides errors until the end; eight separate chats throw away the context each time.",
  },
  {
    day: 8,
    question:
      "You've worked out a reliable way to handle a recurring task, and two colleagues want to use it. What's a Skill for?",
    options: [
      "Packaging that way of working so it can be reused and shared, instead of living in your head",
      "Storing files for a project",
      "Scheduling something to run each morning",
      "Giving Claude access to another system",
    ],
    correct: 0,
    explanation:
      "A Skill turns \"how I do this\" into something repeatable that other people can run. Storing files is a Project, running to a timetable is a Scheduled Task, and reaching another system is a Connector — knowing which is which is most of the skill in choosing.",
  },
  {
    day: 9,
    question:
      "Which of these is the best candidate for a Scheduled Task?",
    options: [
      "A one-off analysis you need this afternoon",
      "The same summary you pull together every Monday morning before your team meeting",
      "A complicated question needing a lot of back-and-forth",
      "Anything you'd rather not do yourself",
    ],
    correct: 1,
    explanation:
      "Scheduled Tasks earn their keep on work that is regular and predictable — same shape, same cadence. One-off or exploratory work doesn't fit a timetable, and \"anything I dislike\" isn't a criterion: if the shape changes every time, a schedule just produces something you have to redo.",
  },
  {
    day: 10,
    question:
      "You're not getting what you want and you're not sure what's missing from your prompt. What does reverse prompting mean here?",
    options: [
      "Asking Claude to write the answer backwards from the conclusion",
      "Asking Claude what it needs to know from you before it attempts the task",
      "Asking the same thing repeatedly until the answer improves",
      "Asking a second AI tool and comparing",
    ],
    correct: 1,
    explanation:
      "Turn the questioning round: have Claude interview you. It surfaces the context you didn't realise you were assuming — which is usually the actual problem. Repeating the prompt just gets you variations on the same misunderstanding.",
  },
];

/* ------------------------------------------------------------------ */
/* Week 3 - day 15. Ten questions, pass 8. Gates the certificate (G4). */
/* ------------------------------------------------------------------ */

export const WEEK_3_QUESTIONS: QuizQuestion[] = [
  {
    day: 11,
    question:
      "You've asked Claude for a checklist your team will use every week. Why ask for it as an Artifact rather than as chat text?",
    options: [
      "It gets generated faster",
      "You get a self-contained thing you can edit, keep and share, instead of something buried in a conversation",
      "Artifacts are more accurate",
      "It uses fewer messages",
    ],
    correct: 1,
    explanation:
      "An Artifact is the output as an object rather than as chat scrollback — editable in place, and shareable without someone reading the whole conversation. Accuracy and speed are unchanged; what changes is whether the work survives the chat.",
  },
  {
    day: 12,
    question:
      "You need a one-page summary that will be shown to the exec team. Where does Claude's design help genuinely apply?",
    options: [
      "It replaces the need for anyone with design skills",
      "It gets you to a clear, presentable first version fast — which you then judge and refine",
      "It only matters for customer-facing material",
      "It guarantees the result is on-brand",
    ],
    correct: 1,
    explanation:
      "The gain is the distance from blank page to something worth reacting to. It doesn't guarantee brand fit and doesn't replace judgement — someone still has to decide whether it's right, and internal work benefits from clarity just as much as customer-facing work does.",
  },
  {
    day: 13,
    question:
      "What problem do Plugins solve that a well-written prompt doesn't?",
    options: [
      "They make Claude's writing better",
      "They add capabilities and connections to other tools, extending what Claude can actually do",
      "They store your previous conversations",
      "They let several people use one account",
    ],
    correct: 1,
    explanation:
      "Prompting changes how well you use what's already there; Plugins change what's there. When the blocker is \"it can't reach that\" rather than \"it misunderstood me\", better wording won't fix it.",
  },
  {
    day: 14,
    question:
      "You spend most of your day in Excel and Slack. What follows from Claude being available inside the tools you already use?",
    options: [
      "You should still do AI work in the Claude app and paste results across",
      "You can use it where the work already is, which removes the context-switch that stops people bothering",
      "The in-tool versions are less capable, so avoid them",
      "It only matters for people who work in documents",
    ],
    correct: 1,
    explanation:
      "The barrier to using AI is rarely capability — it's friction. Having to stop, switch app, re-explain the context and paste back is enough to make people not bother for small tasks, and small tasks are where most of the cumulative time saving lives.",
  },
  {
    day: 15,
    question:
      "You've automated a report that used to take you 45 minutes each week. It now takes 5 minutes to run and check. What should you log as the time saved?",
    options: [
      "45 minutes a week — that's what the task used to cost",
      "40 minutes a week — what it used to cost, minus what it costs now",
      "Nothing, until you've done it for a full quarter",
      "However long the automation took to build, spread over the year",
    ],
    correct: 1,
    explanation:
      "The saving is the difference, not the old total: something still has to be run and checked. Claiming the full 45 overstates it, and overstated numbers are the fastest way to lose trust in the whole exercise. In the May baseline half of respondents couldn't put a number on their saving at all — a defensible small number beats a vague large one.",
  },
  {
    day: 5,
    question:
      "A colleague shares a Claude-drafted summary of a governance policy and says \"it's cited, so it's solid\". What's the flaw?",
    options: [
      "Nothing — citations are exactly what you want",
      "A citation shows a source was referenced, not that it says what the summary claims; the specifics still need checking against the policy",
      "Citations mean the answer took longer to produce",
      "You should ask for more citations",
    ],
    correct: 1,
    explanation:
      "Citations raise confidence far more than they raise reliability — a reference can be real and still not support the claim attached to it. In a regulated environment the check is against the actual document, and \"more citations\" compounds the problem rather than solving it.",
  },
  {
    day: 1,
    question:
      "Which of these is the WEAKEST candidate for handing to Claude?",
    options: [
      "Drafting a first version of a recurring internal update",
      "Summarising a long document you'll read properly afterwards",
      "Making the final call on whether a near-miss needs reporting",
      "Reformatting messy data into a consistent structure",
    ],
    correct: 2,
    explanation:
      "Drafting, summarising and reformatting are exactly where AI earns its keep. A judgement call with regulatory consequences is accountable work: a person owns that decision, and using AI to make it — rather than to gather what informs it — is the line worth being clear about.",
  },
  {
    day: 8,
    question:
      "You built a Skill in week 2 and a colleague says it gives them worse results than it gives you. What's the most likely explanation?",
    options: [
      "They need to build their own version",
      "The Skill assumes context you supply without thinking about it, and they don't know to",
      "Skills only work well for whoever created them",
      "The Skill needs rebuilding from scratch",
    ],
    correct: 1,
    explanation:
      "A Skill packages the method, not everything in your head. The person who wrote it knows what it takes for granted; someone else doesn't. The fix is almost always making those assumptions explicit in the Skill itself — duplicating it just creates two versions that drift apart.",
  },
  {
    day: 9,
    question:
      "A Scheduled Task you set up three weeks ago still runs every Monday, but you've noticed you now edit its output heavily before using it. What should you do?",
    options: [
      "Leave it — it's still saving time overall",
      "Look at what you keep changing and fold that back into the task, or retire it if the work has moved on",
      "Delete it and go back to doing the task manually",
      "Run it more often so it stays current",
    ],
    correct: 1,
    explanation:
      "Heavy editing is the signal that the task and the real work have drifted apart. What you keep changing IS the specification — feed it back in. Leaving it quietly erodes the time saving you're claiming for it, and running it more often just produces more to correct.",
  },
  {
    day: 15,
    question:
      "Three weeks in, what's the most useful thing to do with a prompt you've refined and now rely on?",
    options: [
      "Keep it in a personal note so it doesn't get changed",
      "Share it — as a signed example or a Skill — so the team gets the benefit without rediscovering it",
      "Keep it to yourself until it's perfect",
      "Rewrite it from scratch each time to keep it fresh",
    ],
    correct: 1,
    explanation:
      "A prompt that only exists in your notes saves one person's time once. The compounding gain is other people not solving the same problem again — which is what the gallery and Skills are for. Waiting for perfect means it never gets shared.",
  },
];

export const QUIZ_CONTENT_BY_DAY: Record<number, QuizQuestion[]> = {
  5: WEEK_1_QUESTIONS,
  10: WEEK_2_QUESTIONS,
  15: WEEK_3_QUESTIONS,
};
