-- Three additions for turning the tests into a tool that helps week to week.
-- The app works before this is applied: it falls back to saving without
-- context, and the check-in and practice pages say they're not set up yet.
--
-- 1. context on assessment_results: season, hemisphere and whether the person
--    was away from home when they took a state test (Vikriti, Guna). Only the
--    hemisphere is stored, never a location.
-- 2. checkins: a short check-in (sleep, digestion, energy, mood) between full
--    retakes. Kept apart from assessment_results so it is never mistaken for a
--    Vikriti result.
-- 3. practice_log: what the person actually did, so later results can be read
--    against it.
--
-- Like assessment_results, rows are written only by the server (service role)
-- after validation; users can read their own rows. Account deletion cascades.

alter table public.assessment_results
  add column if not exists context jsonb check (context is null or jsonb_typeof(context) = 'object');

create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  answers       jsonb not null check (jsonb_typeof(answers) = 'object'),
  context       jsonb check (context is null or jsonb_typeof(context) = 'object'),
  completed_at  timestamptz not null default now()
);
create index if not exists checkins_user_time on public.checkins (user_id, completed_at desc);
alter table public.checkins enable row level security;
alter table public.checkins force row level security;
drop policy if exists "owner_select_checkins" on public.checkins;
create policy "owner_select_checkins" on public.checkins for select using (auth.uid() = user_id);
revoke insert, update, delete on public.checkins from anon, authenticated;

create table if not exists public.practice_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  practice    text not null check (length(practice) between 1 and 80),  -- a practice id from src/lib/practices.ts
  done_on     date not null default current_date,
  helped      smallint check (helped between -1 and 1),                  -- -1 worse, 0 no change, 1 better; null = not rated
  created_at  timestamptz not null default now(),
  unique (user_id, practice, done_on)
);
create index if not exists practice_log_user_day on public.practice_log (user_id, done_on desc);
alter table public.practice_log enable row level security;
alter table public.practice_log force row level security;
drop policy if exists "owner_select_practice_log" on public.practice_log;
create policy "owner_select_practice_log" on public.practice_log for select using (auth.uid() = user_id);
revoke insert, update, delete on public.practice_log from anon, authenticated;
