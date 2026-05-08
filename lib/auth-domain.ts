// Single source of truth for which email domains are allowed to authenticate.
// Enforced server-side in three layers (proxy, auth callback, getSessionUser).
// Keep this file dependency-free so it's safe to import from any execution
// context (proxy/Edge, RSC, Server Actions, Route Handlers, client).
export const ALLOWED_EMAIL_DOMAIN = "wearephlo.com";

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
