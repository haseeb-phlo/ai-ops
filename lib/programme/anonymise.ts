/**
 * Stable, non-identifying keys for the external work-sample export.
 *
 * Work samples are scored blind by someone outside the programme, so the CSV
 * must carry no name, email or team - the scorer should not be able to tell
 * whose "before" they are reading, and the file leaves our control once it's
 * downloaded.
 *
 * The input is `programme_cohort_members.id`, a random UUID that is already
 * not personal data. Hashing it is belt-and-braces: even someone holding the
 * CSV and a list of member ids can't join the two without also running the
 * hash, and the truncated digest is short enough to eyeball in a spreadsheet.
 *
 * Stable across exports, so a "before" and an "after" for the same person
 * carry the same key - which is the entire point, since the scorer needs to
 * pair them without knowing who they belong to.
 */

import { createHash } from "node:crypto";

/** Digest length. 12 hex chars = 48 bits: collision-safe at Phlo's scale. */
const KEY_LENGTH = 12;

export function memberKey(cohortMemberId: string): string {
  return createHash("sha256")
    .update(cohortMemberId)
    .digest("hex")
    .slice(0, KEY_LENGTH);
}

/** Escapes one CSV field: quote it, and double any quotes inside. */
export function csvField(value: string | null | undefined): string {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly (readonly (string | null)[])[]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\n");
}

/** Columns that must never appear in a blind-scoring export. */
export const FORBIDDEN_EXPORT_HEADERS = [
  "name",
  "email",
  "team",
  "display_name",
  "user_id",
] as const;

export type WorkSamplePair = {
  cohortMemberId: string;
  preRef: string | null;
  postRef: string | null;
};

/** Header row for the blind-scoring export. Deliberately three columns. */
export const WORK_SAMPLE_HEADER = ["member_key", "pre_ref", "post_ref"] as const;

/**
 * Builds the blind-scoring CSV.
 *
 * Extracted from the Server Action so the "no PII" guarantee is testable
 * rather than a claim in a comment. The only member-identifying input is the
 * cohort_member id, and it is hashed on the way out.
 *
 * Caveat worth knowing: `preRef`/`postRef` are artefact URLs the member typed
 * in, and a link to a personal Drive doc can carry a name in its title. We
 * can't rewrite arbitrary URLs without breaking them, so the anonymity here
 * is of the KEY, not necessarily of the linked artefact.
 */
export function buildWorkSampleCsv(pairs: readonly WorkSamplePair[]): string {
  return toCsv([
    [...WORK_SAMPLE_HEADER],
    ...pairs.map((pair) => [
      memberKey(pair.cohortMemberId),
      pair.preRef,
      pair.postRef,
    ]),
  ]);
}
