import "server-only";

/**
 * Canonical origin for outbound links (email CTAs, notification payloads).
 *
 * Resolved from env vars, never from request headers. Earlier versions built
 * this from `x-forwarded-host` / `host` on each Server Action, which is a
 * host-header injection vector for email content: an attacker who can reach
 * the function with a spoofed Host header gets their domain printed in
 * emails sent to other users.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL - explicit, used to override Vercel's defaults
 *      (e.g. for a custom domain) and on local dev when you want HTTPS-style
 *      links.
 *   2. VERCEL_PROJECT_PRODUCTION_URL - the project's canonical prod host on
 *      Vercel. Set automatically for prod deploys.
 *   3. VERCEL_URL - the unique deploy URL on Vercel. Used for preview
 *      deploys where no production URL exists.
 *   4. http://localhost:3000 - local dev fallback.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return stripTrailingSlash(ensureProtocol(explicit));

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return stripTrailingSlash(`https://${prod}`);

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return stripTrailingSlash(`https://${preview}`);

  return "http://localhost:3000";
}

function ensureProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
