create table public.study_task_progress (
  user_id      uuid        references auth.users(id) on delete cascade not null,
  task_id      text        not null,
  status       text        not null default 'not_started'
                           check (status in ('not_started', 'review', 'completed')),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.study_task_progress enable row level security;

create policy "study_task_progress_select" on public.study_task_progress
  for select using (auth.uid() = user_id);

create policy "study_task_progress_insert" on public.study_task_progress
  for insert with check (auth.uid() = user_id);

create policy "study_task_progress_update" on public.study_task_progress
  for update using (auth.uid() = user_id)
             with check (auth.uid() = user_id);

create policy "study_task_progress_delete" on public.study_task_progress
  for delete using (auth.uid() = user_id);

create trigger handle_updated_at_study_task_progress
  before update on public.study_task_progress
  for each row execute procedure extensions.moddatetime(updated_at);
