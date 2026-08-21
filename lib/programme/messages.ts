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

export function memberReminderText(input: MemberReminder): string {
  const lines: string[] = [];
  const openings = input.hasRejection
    ? `Morning ${input.firstName}. Your team lead sent one of your examples back with a note.`
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

export type LeadDigest = {
  firstName: string;
  members: { name: string; rag: "green" | "amber" | "red" }[];
  pendingSignOffs: number;
  boardUrl: string;
};

export function leadDigestText(input: LeadDigest): string {
  const behind = input.members.filter((m) => m.rag === "red");
  const slipping = input.members.filter((m) => m.rag === "amber");

  const lines = [`Morning ${input.firstName}. Your team's week on the Core Programme.`];

  if (input.pendingSignOffs > 0) {
    lines.push(
      `${input.pendingSignOffs} submission${input.pendingSignOffs === 1 ? "" : "s"} waiting on your sign-off. Each one takes a couple of minutes.`,
    );
  }

  if (behind.length > 0) {
    lines.push(
      `Worth a word with: ${behind.map((m) => m.name).join(", ")}.`,
    );
  } else if (slipping.length > 0) {
    lines.push(`Slipping a little: ${slipping.map((m) => m.name).join(", ")}.`);
  } else if (input.pendingSignOffs === 0) {
    lines.push("Everyone is on track and there is nothing waiting on you.");
  }

  lines.push(input.boardUrl);
  return lines.join("\n\n");
}

export type CohortSummary = {
  cohortName: string;
  weekNumber: number;
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
      `Finished this week: ${input.completedNames.join(", ")}. Nice work.`,
    );
  }
  lines.push(
    "Got something good working? Drop it in the thread so someone else can steal it.",
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

export type CertificateIssued = {
  firstName: string;
  cohortName: string;
  certificateUrl: string;
};

/** The DM to the person. */
export function certificateIssuedText(input: CertificateIssued): string {
  return [
    `${input.firstName}, your Core Programme certificate has been approved.`,
    `All four gates, ${input.cohortName}. That is the whole fifteen days done.`,
    input.certificateUrl,
  ].join("\n\n");
}

/** The public post in the cohort channel. Batched when several land together. */
export function certificateAnnouncementText(names: string[]): string {
  if (names.length === 1) {
    return `${names[0]} has completed the Core Programme.`;
  }
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return `${rest} and ${last} have completed the Core Programme.`;
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
