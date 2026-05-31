-- Enable moddatetime extension for auto updated_at
create extension if not exists moddatetime schema extensions;

-- ─── applications ────────────────────────────────────────────────────────────
create table applications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) not null,
  company      text        not null,
  role         text        not null,
  status       text        not null default 'applied'
                           check (status in ('wishlist', 'applied', 'oa', 'interview', 'offer', 'rejected')),
  location     text,
  job_url      text,
  notes        text,
  applied_date date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── events ──────────────────────────────────────────────────────────────────
create table events (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) not null,
  application_id uuid        references applications(id) on delete cascade not null,
  title          text        not null,
  event_type     text,
  event_date     timestamptz not null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table applications enable row level security;
alter table events        enable row level security;

-- applications: four explicit policies (select / insert / update / delete)
create policy "applications_select" on applications
  for select using (auth.uid() = user_id);

create policy "applications_insert" on applications
  for insert with check (auth.uid() = user_id);

create policy "applications_update" on applications
  for update using     (auth.uid() = user_id)
             with check(auth.uid() = user_id);

create policy "applications_delete" on applications
  for delete using (auth.uid() = user_id);

-- events: four explicit policies
create policy "events_select" on events
  for select using (auth.uid() = user_id);

create policy "events_insert" on events
  for insert with check (auth.uid() = user_id);

create policy "events_update" on events
  for update using     (auth.uid() = user_id)
             with check(auth.uid() = user_id);

create policy "events_delete" on events
  for delete using (auth.uid() = user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create trigger handle_updated_at_applications
  before update on applications
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_events
  before update on events
  for each row execute procedure extensions.moddatetime(updated_at);
