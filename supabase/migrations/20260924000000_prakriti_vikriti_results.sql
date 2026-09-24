-- Separate from prakriti_results on purpose: Vikriti is a short-term current-state
-- check (last 4-6 weeks), not the lifelong constitution, and is meant to be retaken
-- far more often. Scored independently — never merged into prakriti_results.scores.
create table prakriti_vikriti_results (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),   -- { "VK1": ["VAT"], "VK2": ["PIT","KAP"], ... }
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),     -- { "VAT": 2, "PIT": 4, "KAP": 1 } (ticks out of 6 each)
  completed_at timestamptz not null default now()
);

create trigger set_completed_at before update on prakriti_vikriti_results
  for each row execute function public.set_completed_at();

alter table prakriti_vikriti_results enable row level security;
alter table prakriti_vikriti_results force row level security;

create policy "owner_all_prakriti_vikriti" on prakriti_vikriti_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
