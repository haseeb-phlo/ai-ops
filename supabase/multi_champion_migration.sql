-- =========================================================================
-- Phlo AI Ops - allow multiple AI champions per team
--
-- Drops the team-unique constraint on public.champions so a single team
-- (e.g. Executive) can have several champions. To prevent accidentally
-- assigning the same person twice as champion of the same team, replaces
-- it with a partial unique index keyed on (team, user_id) when user_id is
-- not null.
--
-- Safe to re-run.
-- =========================================================================

alter table public.champions
  drop constraint if exists champions_team_key;

create unique index if not exists champions_team_user_unique
  on public.champions (team, user_id)
  where user_id is not null;

create index if not exists champions_team_idx
  on public.champions (team);

notify pgrst, 'reload schema';
