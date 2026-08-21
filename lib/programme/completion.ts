/**
 * Programme completion.
 *
 * Completion is stamped once, when all four gates pass, and never un-stamped.
 * That asymmetry is deliberate: gates are computed from live data, and live
 * data can move. If an admin later corrects an attendance mark or a submission
 * is superseded, a naive "completed = all gates pass right now" would silently
 * revoke someone's certificate weeks after they earned it and after it has
 * been announced in a Slack channel.
 *
 * So `completed_at` is a latch. Once set, it stays set.
 */

import { allGatesPassed, type GateSet } from "./gates";

export type CompletionInput = {
  gates: GateSet;
  /** Existing completed_at, if any. */
  completedAt: string | null;
};

export type CompletionDecision =
  | { action: "none" }
  /** First time all four have passed: stamp it and announce. */
  | { action: "complete" }
  /** Already completed. Nothing to do, and never un-complete. */
  | { action: "already" };

export function decideCompletion(input: CompletionInput): CompletionDecision {
  if (input.completedAt) return { action: "already" };
  return allGatesPassed(input.gates) ? { action: "complete" } : { action: "none" };
}

/** Certificate is visible exactly when completion has been stamped. */
export function canViewCertificate(completedAt: string | null): boolean {
  return completedAt !== null;
}

export type CertificateDetails = {
  name: string;
  cohortName: string;
  completedOn: string;
  gates: { label: string; description: string }[];
};
