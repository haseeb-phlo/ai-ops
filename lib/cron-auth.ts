import { timingSafeEqual } from "node:crypto";

/**
 * Bearer-token gate for the cron route handlers.
 *
 * Production requires the Vercel-issued `Authorization: Bearer ${CRON_SECRET}`
 * header. In non-production we additionally require the request to come from
 * localhost so a misconfigured `NODE_ENV` on a hosted environment can't turn
 * the route into an open trigger.
 *
 * Comparison is constant-time so an attacker can't probe the secret one
 * character at a time via response-timing. Buffers of different lengths
 * short-circuit to false before the comparison runs.
 */
export function isCronAuthorized(args: {
  authorizationHeader: string | null;
  hostHeader: string | null;
  expectedSecret: string | undefined;
  nodeEnv: string | undefined;
}): boolean {
  if (args.nodeEnv === "production") {
    if (!args.expectedSecret) return false;
    return bearerMatches(args.authorizationHeader, args.expectedSecret);
  }
  // Defense in depth: even in dev, only accept localhost. Stops a stray
  // `NODE_ENV=development` deploy from exposing the endpoint publicly.
  return isLocalhost(args.hostHeader);
}

function bearerMatches(
  authHeader: string | null,
  expectedSecret: string,
): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${expectedSecret}`;
  const provided = authHeader;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isLocalhost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hostHeader);
}

/**
 * Strips the domain off an email for response payloads. Keeps enough to
 * identify the row to an operator (e.g. for matching against Resend's
 * dashboard) without dumping a full directory in the body.
 *
 *   "ingrid.maughan@wearephlo.com" -> "ingrid.maughan@…"
 */
export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "…";
  return `${email.slice(0, at)}@…`;
}
