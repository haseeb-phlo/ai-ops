---
paths:
  - "app/api/cron/**"
  - "vercel.json"
  - "lib/cron-auth.ts"
---

# Cron and system-initiated endpoints

Scheduled jobs are declared in `vercel.json` under `crons` (currently a Wednesday-morning digest, `0 7 * * 3` → `/api/cron/digest`) and run as ordinary `app/api/cron/*/route.ts` handlers. Three pieces interlock, and a new job needs all three:

1. **Proxy bypass.** `lib/supabase/proxy.ts` skips the cookie auth gate for paths starting `/api/cron`, because Vercel Cron requests carry no Supabase session - without the skip they'd be redirected to `/login` before the handler ran.
2. **Bearer-token gate.** Every handler must call `isCronAuthorized` (`lib/cron-auth.ts`) before doing any work. Production requires `Authorization: Bearer ${CRON_SECRET}`, compared with `timingSafeEqual`; non-production *additionally* requires a localhost `Host`, so a stray `NODE_ENV=development` deploy can't expose the endpoint.
3. **Service-role DB access.** Handlers have no user JWT, so they use `createAdminClient()` and are responsible for the access checks RLS would otherwise enforce.

`/api/cron/digest` is the canonical example. `app/api/` is reserved for system endpoints like these plus the `/api/search/index` palette index - application mutations belong in route-local `actions.ts`.
