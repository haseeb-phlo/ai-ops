---
paths:
  - "lib/**"
---

# What already exists in `lib/`

Several modules are the single source for a vocabulary that would otherwise get re-declared per surface. Import from them instead of writing a local `Record` map; each carries a docblock stating its invariant.

- `lib/status.ts` - status values *and* their rendering grammar (interventions and suggestions; workflows have no status vocabulary).
- `lib/navigation.ts` - the sidebar, mobile bar, and command-palette "Go to …" entries. The order is a deliberate maturity gradient (realized value → potential → reference); the comment explains it so it doesn't get "tidied".
- `lib/roadmap.ts` - lane keys (which *are* status values) plus `compareQueueOrder`. Server-only queue helpers are in `lib/roadmap-server.ts`, which computes rank bounds across both queue tables.
- `lib/frequency.ts` - cadence vocabulary and the per-week multipliers dashboard math depends on.
- `lib/org.ts` - the hardcoded org tree for People → Directory, keyed on lowercased email so display names still resolve from the `people` directory.
- `lib/tools.ts` - tools-tag autocomplete shared by workflows and initiatives.
- `lib/profile.ts` - `resolveDisplayName` (profile → people → email-local-part) and `resolveAvatar`.

Integrations:

- `lib/anthropic.ts` is `server-only` and exports the client plus `CLAUDE_MODEL`. Import the constant instead of hardcoding a model string, so the model bumps in one place.
- `lib/resend.ts` is `server-only` and exports `resend` **or `null`** when `RESEND_API_KEY` is unset. Callers must null-check; do not throw on a missing key. Templates are plain TS functions in `lib/emails/` returning subject/html/text. `EMAIL_FROM` defaults to the Resend test domain.
- `lib/loom.ts` - `parseLoomId` accepts share/embed URLs or a bare id and returns `null` for anything unparseable, so callers surface a friendly error rather than storing junk.

`lib/auth-domain.ts` is intentionally dependency-free so it can be imported from the Edge proxy, RSC, Server Actions, and client code alike. Keep it that way.
