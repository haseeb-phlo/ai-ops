/**
 * "Your AI Score" - the question bank.
 *
 * q1-q23 wording is IMMUTABLE. None of it is transcribed prose: every string
 * was resolved against the May 2026 export ("Phlo AI Baseline Capability
 * Questionnaire (1-108).xlsx", 108 responses) and is re-checked by
 * tests/programme-questions.test.ts against the committed distribution
 * fixture. Changing a character breaks cross-wave comparability and fails
 * that test.
 *
 * TEXT IS STORED NORMALISED, and input is normalised before matching. The May
 * export contains two non-breaking spaces that an exact-match import would
 * silently fail on - a trailing one in q16's "Neutral", and one *mid-string*
 * in q2's option between the two sentences. `normalizeAnswerText` is the one
 * place that difference is resolved; see MAY_HEADER_TO_QID_RAW for the header
 * strings exactly as the sheet holds them.
 *
 * q19b and q24 are new in the cohort_baseline wave (`addedInWave`), so a
 * may_2026 response legitimately has no answer for them.
 *
 * Capability options (q1-q7) are scored 0-4 BY POSITION - the index in
 * `options` is the score. Never reorder them.
 *
 * The user-facing name is always "Your AI Score"; "questionnaire" appears
 * only in admin surfaces and in table/column names.
 */

export type Wave = "may_2026" | "cohort_baseline" | "post" | "day_90";

export const WAVES: readonly Wave[] = [
  "may_2026",
  "cohort_baseline",
  "post",
  "day_90",
] as const;

export const WAVE_LABEL: Record<Wave, string> = {
  may_2026: "May 2026",
  cohort_baseline: "Cohort baseline",
  post: "End of programme",
  day_90: "90 days on",
};

/**
 * Collapse the typographic variation that separates "the same answer" from
 * "an unrecognised answer": non-breaking spaces, smart quotes, en dashes and
 * runs of whitespace. Applied to every value on ingest and before any option
 * lookup. Without it the May import drops q2 and q16 on the floor.
 */
export function normalizeAnswerText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export type QuestionKind = "capability" | "likert" | "choice" | "text";

export type Question = {
  id: string;
  /** Verbatim (normalised) question text. Immutable for q1-q23. */
  text: string;
  kind: QuestionKind;
  /** Ordered options; for `capability`, index === score 0-4. */
  options?: readonly string[];
  required: boolean;
  section: "A" | "C" | "D" | "E";
  /** Set when the question did not exist in the May 2026 wave. */
  addedInWave?: Wave;
  /**
   * Last wave this question is ASKED in. Later waves skip it.
   *
   * Retired rather than deleted, and the distinction matters: 108 May 2026
   * responses carry answers to q19, the May import maps two spreadsheet
   * headers onto it, and the reporting export resolves its text through
   * QUESTION_BY_ID. Deleting the row would orphan all three - the historical
   * answers would still be in the database with nothing able to name them.
   */
  retiredAfterWave?: Wave;
};

/** The seven radar axes, in FIXED render order. Never reorder. */
export const CAPABILITY_QUESTION_IDS = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
] as const;
export type CapabilityQuestionId = (typeof CAPABILITY_QUESTION_IDS)[number];

/** Short axis labels for the radar, in CAPABILITY_QUESTION_IDS order. */
export const CAPABILITY_AXIS_LABEL: Record<CapabilityQuestionId, string> = {
  q1: "Prompting",
  q2: "Projects",
  q3: "Artefacts",
  q4: "Scheduled Tasks",
  q5: "Connectors",
  q6: "Skills",
  q7: "AI Ops",
};

export const LIKERT_OPTIONS = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
] as const;

export const QUESTIONS: readonly Question[] = [
  // --- Section A: capability, scored 0-4 by option position ---------------
  {
    id: "q1",
    text: "Writing effective prompts",
    kind: "capability",
    options: [
      "I don't really write prompts - I ask questions in plain English and accept the answer I get.",
      "I wrote one-line prompts and sometimes add more context if the answer is bad.",
      "I write structured prompts with context, role and clear instructions. Most prompts work first time.",
      "I write prompts using a framework and iterate when needed. I have prompts I reuse.",
      "I've designed a bank of prompts with variations and examples. Others on my team have used prompts I've written.",
    ],
    required: true,
    section: "A",
  },
  {
    id: "q2",
    text: "Using Claude Projects",
    kind: "capability",
    options: [
      "I don't know what Claude Projects are.",
      "I've heard of them but haven't used one.",
      "I've created one or two which I use it occasionally. I mostly still paste context into chats.",
      "I have 2+ active Projects I use weekly with relevant documents uploaded.",
      "I've designed Projects that other people on my team now use.",
    ],
    required: true,
    section: "A",
  },
  {
    id: "q3",
    text: "Using Claude Artefacts",
    kind: "capability",
    options: [
      "I don't know what Artefacts are.",
      "I've heard of them but don't know how to use them.",
      "I've created an Artefact a few times.",
      "I regularly use Artefacts when they fit the task.",
      "I deliberately design AI work to produce shareable Artefacts.",
    ],
    required: true,
    section: "A",
  },
  {
    id: "q4",
    text: "Using Claude Scheduled Tasks",
    kind: "capability",
    options: [
      "I don't know what scheduled tasks are.",
      "I've heard of them but don't know how to set one up.",
      "I've set one up but I'm not sure I'm using it well.",
      "I have 2+ scheduled tasks running which save me time and give me good outputs.",
      "Others use the scheduled tasks I've designed.",
    ],
    required: true,
    section: "A",
  },
  {
    id: "q5",
    text: "Using MCP / Connectors",
    kind: "capability",
    options: [
      "I don't know what MCP or Connectors are.",
      "I've heard of them but haven't connected anything.",
      "I have 1-2 connectors enabled but haven't touched them since connecting them.",
      "I actively choose connectors based on the task.",
      "I've helped my team set up connectors.",
    ],
    required: true,
    section: "A",
  },
  {
    id: "q6",
    text: "Using Skills.",
    kind: "capability",
    options: [
      "I don't know what Skills are.",
      "I've heard of them but haven't added one.",
      "I have 1-2 skills which I use when needed.",
      "I'm actively writing new skills when the opportunity arises.",
      "Others in my team use the skills I've made.",
    ],
    required: true,
    section: "A",
  },
  {
    id: "q7",
    text: "Using AI Ops",
    kind: "capability",
    options: [
      "I haven't logged into AI Ops yet.",
      "I have logged in but don't know how to use it.",
      "I've added a workflow, suggestion or watch an AI training video.",
      "I have added something to AI Ops and want to use it more.",
      "I use it as my go to resource for everything AI at Phlo.",
    ],
    required: true,
    section: "A",
  },
  { id: "q8", text: "Name any other AI tools you use and your confidence with them.", kind: "text", required: false, section: "A" },

  // --- Section C: confidence, Likert, all compulsory ------------------------
  { id: "q9", text: "I feel confident using AI for my core work tasks", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },
  { id: "q10", text: "I feel confident explaining what AI can and can't do to a colleague", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },
  { id: "q11", text: "I feel confident designing an AI workflow from scratch", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },
  { id: "q12", text: "I feel confident keeping up with AI changes", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },
  { id: "q13", text: "I feel confident pushing back when AI gives a wrong or weak answer", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },
  { id: "q14", text: "I feel confident teaching a teammate to use an AI tool I know well.", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },
  { id: "q15", text: "I feel confident choosing the right AI tool or model for a given task.", kind: "likert", options: LIKERT_OPTIONS, required: true, section: "C" },

  // --- Section D: usage and sentiment ---------------------------------------
  {
    id: "q16",
    text: "How do you currently feel about using AI at work?",
    kind: "choice",
    options: [
      "Energised & building things",
      "Interested & learning the basics",
      "Neutral",
      "Curious but stuck",
      "Anxious & over-whelmed",
    ],
    required: true,
    section: "D",
  },
  {
    id: "q17",
    text: "How do you feel about Phlo's pace and approach to AI?",
    kind: "choice",
    options: [
      "The pace and approach is right - it feels sustainable.",
      "Moving too fast - I would like more time to consolidate before the next step.",
      "Moving too slow - I want more support, faster.",
      "I don't know enough about Phlo's AI strategy to have a view.",
    ],
    required: true,
    section: "D",
  },
  {
    id: "q18",
    text: "How many days per week do you use AI for work?",
    kind: "choice",
    // Stored numeric 1-5 in May; no respondent picked 0, but 0 is offered.
    options: ["0", "1", "2", "3", "4", "5"],
    required: true,
    section: "D",
  },
  {
    id: "q19",
    text: "How many hours per week does AI save you (rough estimate)?",
    // Free text on purpose. May answers are mixed ("5", "10", prose) and are
    // kept verbatim for comparability - never coerce to a number.
    kind: "text",
    required: false,
    section: "D",
    // Superseded by q19b, which asks the same thing as a band. Both shipped
    // together in the cohort_baseline form, so section D asked how many hours
    // AI saves you twice in a row - once as a dropdown, once as a box.
    retiredAfterWave: "may_2026",
  },
  {
    id: "q19b",
    text: "How many hours per week does AI save you?",
    kind: "choice",
    options: ["0", "under 1", "1-3", "3-5", "5-10", "10+", "can't estimate"],
    required: true,
    section: "D",
    addedInWave: "cohort_baseline",
  },

  // --- Section E: free text, all optional, behind an expander ---------------
  { id: "q20", text: "What's the biggest thing blocking you from using AI at work?", kind: "text", required: false, section: "E" },
  { id: "q21", text: "Where would AI training make the most difference to you?", kind: "text", required: false, section: "E" },
  { id: "q22", text: "What's one thing you wish AI could help with?", kind: "text", required: false, section: "E" },
  { id: "q23", text: "Any other comments?", kind: "text", required: false, section: "E" },
  {
    id: "q24",
    text: "One task you tried AI on and stopped \u2014 why?",
    kind: "text",
    required: false,
    section: "E",
    addedInWave: "cohort_baseline",
  },
] as const;

export const QUESTION_BY_ID: ReadonlyMap<string, Question> = new Map(
  QUESTIONS.map((q) => [q.id, q]),
);

/**
 * The questions a given wave actually asks.
 *
 * QUESTIONS is the full historical set, because every wave's answers have to
 * stay resolvable; this is the subset a respondent sees. Use it for anything
 * member-facing - QUESTIONS directly is for import, export and lookup.
 */
export function questionsForWave(wave: Wave): readonly Question[] {
  const index = WAVES.indexOf(wave);
  return QUESTIONS.filter((q) => {
    if (q.addedInWave && WAVES.indexOf(q.addedInWave) > index) return false;
    if (q.retiredAfterWave && WAVES.indexOf(q.retiredAfterWave) < index) {
      return false;
    }
    return true;
  });
}

/** Ids a respondent must answer before the form will submit. */
export const REQUIRED_QUESTION_IDS: readonly string[] = QUESTIONS.filter(
  (q) => q.required,
).map((q) => q.id);

/**
 * May 2026 export column header -> question id, headers NORMALISED.
 *
 * This is the mapping file the playbook asks to be committed. The importer
 * keys on column *order* (headers 7-29 -> q1-q23), but this map is the record
 * of which order was verified, and lets a re-export be checked header-by-header
 * before anything is written.
 */
export const MAY_HEADER_TO_QID: Readonly<Record<string, string>> = {
  ["Writing effective prompts"]: "q1",
  ["Using Claude Projects"]: "q2",
  ["Using Claude Artefacts"]: "q3",
  ["Using Claude Scheduled Tasks"]: "q4",
  ["Using MCP / Connectors"]: "q5",
  ["Using Skills."]: "q6",
  ["Using AI Ops"]: "q7",
  ["Name any other AI tools you use and your confidence with them."]: "q8",
  ["I feel confident using AI for my core work tasks"]: "q9",
  ["I feel confident explaining what AI can and can't do to a colleague"]: "q10",
  ["I feel confident designing an AI workflow from scratch"]: "q11",
  ["I feel confident keeping up with AI changes"]: "q12",
  ["I feel confident pushing back when AI gives a wrong or weak answer"]: "q13",
  ["I feel confident teaching a teammate to use an AI tool I know well."]: "q14",
  ["I feel confident choosing the right AI tool or model for a given task."]: "q15",
  ["How do you currently feel about using AI at work?"]: "q16",
  ["How do you feel about Phlo's pace and approach to AI?"]: "q17",
  ["How many days per week do you use AI for work?"]: "q18",
  ["How many hours per week does AI save you (rough estimate)?"]: "q19",
  ["What's the biggest thing blocking you from using AI at work?"]: "q20",
  ["Where would AI training make the most difference to you?"]: "q21",
  ["What's one thing you wish AI could help with?"]: "q22",
  ["Any other comments?"]: "q23",
};

/**
 * The same mapping with headers exactly as the sheet stores them, including
 * any non-breaking spaces. Kept separate so a header comparison can be run
 * against raw bytes without normalising first.
 */
export const MAY_HEADER_TO_QID_RAW: Readonly<Record<string, string>> = {
  ["Writing effective prompts"]: "q1",
  ["Using Claude Projects"]: "q2",
  ["Using Claude Artefacts"]: "q3",
  ["Using Claude Scheduled Tasks"]: "q4",
  ["Using MCP / Connectors"]: "q5",
  ["Using Skills."]: "q6",
  ["Using AI Ops"]: "q7",
  ["Name any other AI tools you use and your confidence with them."]: "q8",
  ["I feel confident using AI for my core work tasks"]: "q9",
  ["I feel confident explaining what AI can and can't do to a colleague"]: "q10",
  ["I feel confident designing an AI workflow from scratch"]: "q11",
  ["I feel confident keeping up with AI changes"]: "q12",
  ["I feel confident pushing back when AI gives a wrong or weak answer"]: "q13",
  ["I feel confident teaching a teammate to use an AI tool I know well."]: "q14",
  ["I feel confident choosing the right AI tool or model for a given task."]: "q15",
  ["How do you currently feel about using AI at work?"]: "q16",
  ["How do you feel about Phlo's pace and approach to AI?"]: "q17",
  ["How many days per week do you use AI for work?"]: "q18",
  ["How many hours per week does AI save you (rough estimate)?"]: "q19",
  ["What's the biggest thing blocking you from using AI at work?"]: "q20",
  ["Where would AI training make the most difference to you?"]: "q21",
  ["What's one thing you wish AI could help with?"]: "q22",
  ["Any other comments?"]: "q23",
};

/** 1-based sheet column of the first question ("Writing effective prompts"). */
export const MAY_FIRST_QUESTION_COLUMN = 7;

/** Question ids in May-export column order from MAY_FIRST_QUESTION_COLUMN. */
export const MAY_QID_BY_COLUMN_ORDER: readonly string[] =
  Object.values(MAY_HEADER_TO_QID);

