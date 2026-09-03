/**
 * Message text for every programme notification.
 *
 * Pure functions returning plain strings, so the wording is unit-testable and
 * reviewable in one place rather than scattered through cron handlers. The
 * same text is used for Slack and for the email fallback; email wraps it in
 * the existing template shell.
 *
 * Tone rules, because these land in people's DMs during a mandatory
 * programme and the wrong register makes people disengage:
 *
 *   - Say what is outstanding and what to do. No "you are behind".
 *   - Never guilt. Someone on a late shift who has missed two days does not
 *     need to be told off by a robot.
 *   - One link, one action. A digest with six links gets skimmed and closed.
 *   - House style: hyphens, not em dashes; no Oxford comma.
 */

export type MemberReminder = {
  firstName: string;
  outstandingCount: number;
  /** Days whose items are open, lowest first. */
  openDays: number[];
  trackUrl: string;
  hasRejection: boolean;
};

/** The Monday 9am nudge. */
export function memberReminderText(input: MemberReminder): string {
  const lines: string[] = [];
  // The sent-back opening names no one. It used to say "your team lead", which
  // is wrong whenever the reviewer was not them - sign-off can route to a
  // cohort's default approver, and an AI-assisted review is not a team lead at
  // all. The passive is the accurate voice here, and the note itself is in the
  // rejection DM that already went out.
  const openings = input.hasRejection
    ? `${input.firstName}, one of your submissions has been sent back with a note.`
    : `Morning ${input.firstName}.`;
  lines.push(openings);

  if (input.outstandingCount > 0) {
    const days =
      input.openDays.length > 0
        ? ` (day${input.openDays.length === 1 ? "" : "s"} ${input.openDays.slice(0, 4).join(", ")})`
        : "";
    lines.push(
      `You have ${input.outstandingCount} thing${input.outstandingCount === 1 ? "" : "s"} open on the Core Programme${days}. Most days are about ten minutes.`,
    );
  }

  lines.push(input.trackUrl);
  return lines.join("\n\n");
}

export type LeadDigestMember = {
  name: string;
  /**
   * Slack mention like "<@U123>", or null when there is nobody to ping - no
   * Slack account, or they have opted out of programme notifications.
   */
  mention: string | null;
  rag: "green" | "amber" | "red";
};

export type LeadDigest = {
  firstName: string;
  members: LeadDigestMember[];
  pendingSignOffs: number;
  boardUrl: string;
  /**
   * Render the named people as Slack mentions. True for the Slack DM, false
   * for the email fallback, where "<@U123>" is not a name but a literal.
   */
  tagged: boolean;
};

export function leadDigestText(input: LeadDigest): string {
  const behind = input.members.filter((m) => m.rag === "red");
  const slipping = input.members.filter((m) => m.rag === "amber");
  // A mention in a DM the named person is not in does not notify them - it
  // renders as their name, linked to their profile. So this is a nicety for
  // the lead reading it, not a ping for the person named, which is the right
  // way round for a message about somebody's progress.
  const nameOf = (m: LeadDigestMember) =>
    input.tagged && m.mention ? m.mention : m.name;

  const lines = [`Morning ${input.firstName}. Your team's week on the Core Programme.`];

  if (input.pendingSignOffs > 0) {
    lines.push(
      `${input.pendingSignOffs} submission${input.pendingSignOffs === 1 ? "" : "s"} waiting on your sign-off. Each one takes a couple of minutes.`,
    );
  }

  if (behind.length > 0) {
    lines.push(`Worth a word with: ${joinNames(behind.map(nameOf))}.`);
  } else if (slipping.length > 0) {
    lines.push(`Slipping a little: ${joinNames(slipping.map(nameOf))}.`);
  } else if (input.pendingSignOffs === 0) {
    lines.push("Everyone is on track and there is nothing waiting on you.");
  }

  lines.push(input.boardUrl);
  return lines.join("\n\n");
}

export type CohortSummary = {
  cohortName: string;
  weekNumber: number;
  /**
   * Who finished this week - Slack mentions where we have one, plain names
   * otherwise, resolved by the caller exactly as cohortCompletionText's are.
   * This only ever goes to a channel, so a mention is always the right
   * rendering and there is no email fallback to corrupt.
   */
  completedNames: string[];
  onTrack: number;
  total: number;
};

export function cohortSummaryText(input: CohortSummary): string {
  const lines = [
    `*${input.cohortName} - week ${input.weekNumber}*`,
    `${input.onTrack} of ${input.total} on track.`,
  ];
  if (input.completedNames.length > 0) {
    lines.push(
      `Finished this week: ${joinNames(input.completedNames)}. Nice work.`,
    );
  }
  lines.push(
    "Got something good working? Drop it in the thread so someone else can get inspired.",
  );
  return lines.join("\n");
}

export type RejectionNotice = {
  firstName: string;
  itemTitle: string;
  leadName: string;
  comment: string;
  trackUrl: string;
};

export function rejectionText(input: RejectionNotice): string {
  return [
    `${input.firstName}, ${input.leadName} has sent your ${input.itemTitle.toLowerCase()} back for another go.`,
    `Their note: "${input.comment}"`,
    `Resubmit whenever you are ready - it goes straight back to them.`,
    input.trackUrl,
  ].join("\n\n");
}

/**
 * Joins names or Slack mentions into a readable list.
 *
 * No Oxford comma, per house style: "Sam, Jo and Pat".
 */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} and ${last}`;
}

export type CohortCompletion = {
  cohortName: string;
  /**
   * One entry per person, already resolved: a Slack mention like "<@U123>"
   * where we have an id, otherwise their plain display name. Resolved by the
   * caller because a missing Slack account must cost someone their tag, never
   * their place on the list.
   */
  mentions: readonly string[];
};

/**
 * The one channel post at the end of the programme.
 *
 * ONE POST PER COHORT, not one per person. Announcing each completion as it
 * landed meant a cohort channel could take ten separate posts on the last
 * afternoon, which reads as noise rather than as an occasion. This goes out
 * once, at 4pm on the final Friday, naming everyone who got there.
 */
export function cohortCompletionText(input: CohortCompletion): string {
  return [
    `*${input.cohortName} - the Core Programme is done*`,
    `Congratulations to ${joinNames(input.mentions)}.`,
    "Fifteen days of videos, daily tasks, live sessions and five pieces of work shared, finished alongside the day job.",
  ].join("\n\n");
}

export type DayNinetyNudge = {
  firstName: string;
  scoreUrl: string;
};

export function dayNinetyText(input: DayNinetyNudge): string {
  return [
    `${input.firstName}, it has been three months since your cohort finished.`,
    "Sixty seconds to see what stuck. It is pre-filled from your last score, so you only change what has moved.",
    input.scoreUrl,
  ].join("\n\n");
}
