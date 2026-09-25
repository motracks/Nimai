-- One append-only table for every questionnaire result. Each completion is a
-- new row, so the first row per instrument is the user's baseline and later
-- rows show progression. Scores are written only by the server (service role)
-- after validating the answers; users can read their own rows but not write.
--
-- The legacy per-instrument tables are left in place, untouched, and copied
-- in here once as source = 'legacy_backfill' so early results become the
-- baseline instead of being lost.

create table public.assessment_results (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  instrument          text not null check (instrument in ('bigfive', 'ecrr', 'guna', 'prakriti', 'vikriti')),
  instrument_version  text not null,   -- which item set / answer scale, see src/lib/instruments.ts
  scoring_version     text not null,   -- which scoring rules produced `result`
  answers             jsonb not null check (jsonb_typeof(answers) = 'object'),
  result              jsonb not null check (jsonb_typeof(result) = 'object'),  -- ScoredResult, or { "legacy": <old row> }
  source              text not null default 'app' check (source in ('app', 'legacy_backfill')),
  completed_at        timestamptz not null default now()
);

create index assessment_results_user_instrument_time
  on public.assessment_results (user_id, instrument, completed_at desc);

alter table public.assessment_results enable row level security;
alter table public.assessment_results force row level security;

create policy "owner_select_assessment_results" on public.assessment_results
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy: only the service role (server action) writes.
revoke insert, update, delete on public.assessment_results from anon, authenticated;

-- Latest and first result per user and instrument. security_invoker makes the
-- views run with the caller's rights, so the table's RLS still applies.
create view public.current_assessment_results with (security_invoker = true) as
  select distinct on (user_id, instrument) *
  from public.assessment_results
  order by user_id, instrument, completed_at desc;

create view public.baseline_assessment_results with (security_invoker = true) as
  select distinct on (user_id, instrument) *
  from public.assessment_results
  order by user_id, instrument, completed_at asc;

-- ---------- backfill from the legacy tables ----------
-- Guarded with to_regclass because those tables were created outside the
-- migrations folder and don't exist on a fresh local database.

do $$
declare
  legacy record;
begin
  for legacy in
    select * from (values
      ('bigfive_results',           'bigfive'),
      ('ecrr_results',              'ecrr'),
      ('guna_results',              'guna'),
      ('prakriti_results',          'prakriti'),
      ('prakriti_vikriti_results',  'vikriti')
    ) as t(tbl, instrument)
  loop
    if to_regclass('public.' || legacy.tbl) is null then
      continue;
    end if;

    execute format($sql$
      insert into public.assessment_results
        (user_id, instrument, instrument_version, scoring_version, answers, result, source, completed_at)
      select
        r.user_id,
        %1$L,
        case %1$L
          -- Big Five ran on a 1-5 scale until 2026-09-21. A 6 anywhere proves the
          -- 6-point version; older rows without one can't be told apart.
          when 'bigfive' then
            case
              when exists (select 1 from jsonb_each(r.answers) e where e.value = '6'::jsonb)
                or coalesce((to_jsonb(r) ->> 'completed_at')::timestamptz, now()) >= '2026-09-24'
                then 'ipip50-6pt'
              else 'ipip50-scale-unverified'
            end
          when 'ecrr' then 'ecrr36-6pt'
          when 'guna' then 'guna36-6pt'
          -- The 24-item Prakriti stored the chosen option text; the 40-item one stores ticks.
          when 'prakriti' then
            case when jsonb_typeof(r.answers -> 'P01') = 'array' then 'govardhan40' else 'prakriti24' end
          when 'vikriti' then 'govardhan-vk6'
        end,
        '1',
        r.answers,
        jsonb_build_object('legacy', to_jsonb(r) - 'answers' - 'user_id'),
        'legacy_backfill',
        coalesce((to_jsonb(r) ->> 'completed_at')::timestamptz, (to_jsonb(r) ->> 'created_at')::timestamptz, now())
      from public.%2$I r
      where jsonb_typeof(r.answers) = 'object'
        and not exists (
          select 1 from public.assessment_results a
          where a.user_id = r.user_id and a.instrument = %1$L and a.source = 'legacy_backfill'
        )
    $sql$, legacy.instrument, legacy.tbl);
  end loop;
end
$$;
