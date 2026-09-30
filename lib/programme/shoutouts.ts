import type { IsoDate } from "./working-days";

/**
 * Dated one-off posts to a cohort's Slack channel.
 *
 * Everything else the programme posts is generated - a summary, a roundup, a
 * reminder - and all of it sits behind SLACK_NOTIFICATIONS_ON. A shout-out is
 * the other kind of message: written by a person, for a day they picked, about
 * someone in particular. It goes out on that morning and never again, and the
 * off switch does not apply to it, for the same reason it does not apply to
 * the admin test button - somebody asked for exactly this to be posted.
 *
 * The table is data, in the DAY_HOLDS shape: an entry is inert once its date
 * has passed, so nothing has to be unset afterwards. Take spent entries out
 * when convenient; an old one left here is a post that already happened, not
 * one that is going to.
 *
 * The person is resolved at send time, not here. A Slack member id belongs in
 * `profiles.slack_user_id`, where the DM path also looks, so the entry carries
 * the email that finds it and a plain name to fall back to. A missing Slack
 * account costs someone their tag, never their post.
 */
export type Shoutout = {
  /** The London date it goes out, posted at `SHOUTOUT_HOUR` that morning. */
  date: IsoDate;
  /** programme_cohorts.id. The channel is read off the cohort row at send time. */
  cohortId: string;
  /** Who it is about, matched to a member of that cohort by email. */
  person: { email: string; name: string };
  /**
   * The post, given the person as a Slack mention like "<@U123>" or, when no
   * account can be found, as `person.name`.
   */
  text: (person: string) => string;
  /** A comment posted in the thread under it, or null for none. */
  threadReply: string | null;
};

/** London hour a shout-out goes out. Same morning slot as the Monday nudge. */
export const SHOUTOUT_HOUR = 9;

export const SHOUTOUTS: readonly Shoutout[] = [
  {
    // Cohort 1A, #ai-training-cohort-1a.
    date: "2026-10-05",
    cohortId: "ecffee4e-ba39-4043-b5d6-4b78c8e578f8",
    person: { email: "lauren.nicholson@wearephlo.com", name: "Lauren Nicholson" },
    text: (person) =>
      [
        `A special congratulations to ${person} on working super hard to complete her AI training.`,
        "She has been exemplary in her effort and dedication to AI and made huge strides in her AI knowledge and daily usage.",
        "Can we all put our hands together to show our appreciation? 👏👏👏.",
      ].join("\n\n"),
    threadReply: "Lauren did not ask for this message at all, I promise 👀.",
  },
];

/** The shout-outs dated `today`, in table order. Usually none. */
export function dueShoutouts(
  today: IsoDate,
  list: readonly Shoutout[] = SHOUTOUTS,
): Shoutout[] {
  return list.filter((s) => s.date === today);
}

/**
 * The claim key. Cohort and date, no time: a shout-out is posted once, and a
 * retried or double-fired cron finds the claim and stops.
 */
export function shoutoutPeriodKey(shoutout: Shoutout): string {
  return `shoutout:${shoutout.cohortId}:${shoutout.date}`;
}
