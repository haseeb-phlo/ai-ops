-- Champions previously stored only display_name plus a nullable user_id
-- (set once the person has signed in). That left no stable identity for
-- people who haven't logged in yet, so duplicate detection had to fall
-- back to display-name matching - which breaks when two people share a
-- name. Store the person's email on the row so both the server action
-- and the admin UI can dedupe by identity.

alter table public.champions
  add column if not exists email text;

-- Backfill from auth.users where the sign-in link already exists.
update public.champions c
set email = lower(u.email)
from auth.users u
where c.user_id = u.id
  and c.email is null;

-- Best-effort backfill for not-yet-signed-in champions: match the stored
-- display name against the people directory, but only when the name maps
-- to exactly one person (ambiguous names stay null rather than guessing).
update public.champions c
set email = lower(p.email)
from public.people p
where c.email is null
  and lower(trim(p.display_name)) = lower(trim(c.display_name))
  and (
    select count(*)
    from public.people p2
    where lower(trim(p2.display_name)) = lower(trim(c.display_name))
  ) = 1;

-- Same person can champion many teams, but only once per team. Partial so
-- legacy rows without an email don't block each other; the existing
-- (team, user_id) partial unique index keeps covering signed-in users.
create unique index if not exists champions_team_email_key
  on public.champions (team, lower(email))
  where email is not null;
