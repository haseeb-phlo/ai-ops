// Pacing + retry policy for bulk email sends through Resend.
//
// Resend enforces a per-second API request cap (2/s on the default plan;
// higher on upgraded accounts). A tight send loop over the whole org blows
// through that cap and every rejected recipient silently misses the digest -
// this happened on the 2026-06-24 and 2026-07-08 sends. Two defences:
//
//   1. Pace: wait SEND_INTERVAL_MS between sends so a normal run never hits
//      the cap, whatever tier the account is on.
//   2. Retry: if a send is rate-limited anyway, back off exponentially and
//      retry instead of dropping the recipient.
//
// Dependency-free so it can be unit-tested without the server-only Resend
// client (same reasoning as lib/cron-auth.ts).

/** Gap between consecutive sends: ~1.6/s, under every Resend tier's cap. */
export const SEND_INTERVAL_MS = 600;

/** Rate-limited sends are retried this many times before giving up. */
export const RATE_LIMIT_MAX_RETRIES = 3;

const RATE_LIMIT_BASE_DELAY_MS = 1_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Matches Resend's rate-limit error. The SDK reports `name:
 * "rate_limit_exceeded"`; the message check is a fallback in case the SDK
 * changes the name field.
 */
export function isRateLimitError(err: {
  name?: string | null;
  message?: string | null;
}): boolean {
  return (
    err.name === "rate_limit_exceeded" ||
    /too many requests/i.test(err.message ?? "")
  );
}

/** Exponential backoff: 1s, 2s, 4s, ... for attempt 0, 1, 2, ... */
export function backoffDelayMs(attempt: number): number {
  return RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
}
