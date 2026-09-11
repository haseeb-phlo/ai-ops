/**
 * "What should we fix on Monday?" - the hackathon problem survey's question
 * bank.
 *
 * WORDING IS VERBATIM from the build sheet
 * (".superset/attachments/AI-Hackathon-Problem-Survey.docx"), including the
 * subtitles and every option string, and `tests/hackathon-questions.test.ts`
 * re-checks it. Two reasons it is copied rather than paraphrased:
 *
 *   1. The sheet was written to be pasted into Microsoft Forms. Anyone
 *      comparing the two should find the same instrument, so responses stay
 *      poolable if it is ever run there.
 *   2. Question 7 ("Does the task involve patient information?") is a
 *      screening question: anything answered "Yes - names, addresses or
 *      medical details" is dropped from the shortlist, and that filter
 *      matches on the option text, so a reworded option breaks it silently.
 *
 * The bank is the ONLY place question ids, wording and options are named.
 * `answers_json` stores `{ qid: { value } }` and nothing else, exactly as
 * `ai_score_responses` does against `lib/programme/questions.ts`, so a
 * question can be re-labelled here without a migration and an option string
 * cannot.
 *
 * House style: hyphens, never em or en dashes (tests/programme-no-em-dashes).
 */

export type QuestionKind = "choice" | "text_short" | "text_long";

export type Question = {
  id: string;
  /** Verbatim question text from the build sheet. */
  text: string;
  kind: QuestionKind;
  /** Verbatim helper text shown under the question, where the sheet has one. */
  subtitle?: string;
  /** Ordered options, verbatim. Choice questions only. */
  options?: readonly string[];
  required: boolean;
};

/**
 * Reused verbatim by q3 and by `lib/hackathon/impact.ts`, which multiplies
 * them. Exported so the impact matrix cannot drift from the option list.
 */
export const FREQUENCY_OPTIONS = [
  "Several times a day",
  "About once a day",
  "A few times a week",
  "About once a week",
  "A few times a month",
] as const;

export const DURATION_OPTIONS = [
  "Under 5 minutes",
  "5 to 15 minutes",
  "15 to 30 minutes",
  "30 to 60 minutes",
  "Over an hour",
] as const;

export type FrequencyOption = (typeof FREQUENCY_OPTIONS)[number];
export type DurationOption = (typeof DURATION_OPTIONS)[number];

/**
 * The sheet's fixed list, NOT `people.team`.
 *
 * The directory holds sixteen teams where the sheet offers eleven coarser
 * buckets: "Dispensary / Fulfilment" is two directory teams, "Engineering"
 * is the directory's "Technology". Using the directory instead would make
 * "the chosen problems come from at least three different teams" count
 * different things for different respondents.
 */
export const TEAM_OPTIONS = [
  "Patient Care",
  "Dispensary / Fulfilment",
  "Clinical (pharmacists, prescribers, dieticians)",
  "Marketing",
  "Product",
  "Design",
  "Finance",
  "People & Culture",
  "Governance",
  "Engineering",
  "Other",
] as const;

/** The q7 answer that keeps a problem out of the first cohort's shortlist. */
export const PATIENT_IDENTIFIERS_ANSWER =
  "Yes - names, addresses or medical details";

export const QUESTIONS: readonly Question[] = [
  {
    id: "q1",
    text: "Which team are you in?",
    kind: "choice",
    options: TEAM_OPTIONS,
    required: true,
  },
  {
    id: "q2",
    text: "Describe one task you do regularly that feels like it should not need a person.",
    kind: "text_long",
    subtitle:
      'Say what you actually do, step by step, in two or three sentences. Example: "When a patient emails to change their delivery address I open Intercom, find their order in the pharmacy system, update it, then reply to confirm."',
    required: true,
  },
  {
    id: "q3",
    text: "How often do you do it?",
    kind: "choice",
    options: FREQUENCY_OPTIONS,
    required: true,
  },
  {
    id: "q4",
    text: "Roughly how long does it take each time?",
    kind: "choice",
    options: DURATION_OPTIONS,
    required: true,
  },
  {
    id: "q5",
    text: "Which systems, tools or documents does it involve?",
    kind: "text_short",
    subtitle:
      "Name them. For example: Intercom, Jira, Slack, Outlook, a spreadsheet, the pharmacy system, Confluence.",
    required: true,
  },
  {
    id: "q6",
    text: "What goes wrong when it is done late or done badly?",
    kind: "text_short",
    subtitle:
      "For example: a patient waits longer, a colleague has to redo it, something gets missed, a complaint.",
    required: true,
  },
  {
    id: "q7",
    text: "Does the task involve patient information?",
    kind: "choice",
    options: [
      PATIENT_IDENTIFIERS_ANSWER,
      "Yes - but only anonymised or aggregated",
      "No",
      "Not sure",
    ],
    required: true,
  },
  {
    id: "q8",
    text: "Could you bring three real examples on Monday, with patient details removed?",
    kind: "choice",
    options: ["Yes", "No", "Not sure"],
    required: true,
  },
  {
    id: "q9",
    text: "Who would use a fix if one existed?",
    kind: "choice",
    options: ["Just me", "My team", "Several teams", "Not sure"],
    required: true,
  },
  {
    id: "q10",
    text: "Is there a second task you would like to put forward? One line is enough.",
    kind: "text_short",
    required: false,
  },
  {
    id: "q11",
    text: "Is there anything specific you want to get out of Monday?",
    kind: "text_short",
    subtitle:
      "For example: learn how to set up a Claude Project, understand how to test whether AI output is right, see how engineers build things.",
    required: false,
  },
] as const;

export const QUESTION_BY_ID: ReadonlyMap<string, Question> = new Map(
  QUESTIONS.map((q) => [q.id, q]),
);

export const REQUIRED_QUESTION_IDS: readonly string[] = QUESTIONS.filter(
  (q) => q.required,
).map((q) => q.id);

/** Longest answer the server will store, per field. Generous but bounded. */
export const ANSWER_MAX_LENGTH = 4000;

/**
 * Collapse the typographic variation that separates "the same answer" from
 * "an unrecognised answer": non-breaking spaces, smart quotes, en dashes and
 * runs of whitespace. Applied to every value before any option lookup.
 *
 * A copy of the programme's rather than an import: that one is load-bearing
 * for the May 2026 import, and the two banks must be free to diverge without
 * either quietly changing what the other stores.
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

/**
 * Free-text answers keep their line breaks - the step-by-step description in
 * q2 is unreadable as one run-on line - so they get the character
 * substitutions without the whitespace collapse.
 */
export function normalizeLongText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The stored shape of one response's answers. */
export type Answers = Record<string, { value: string }>;

export function answerValue(
  answers: Answers | null | undefined,
  qid: string,
): string | null {
  const raw = answers?.[qid]?.value;
  return raw && raw.trim() !== "" ? raw : null;
}
