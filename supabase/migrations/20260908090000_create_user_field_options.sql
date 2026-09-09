-- ─── user_field_options ──────────────────────────────────────────────────────
-- Per-user saved custom values for combobox fields (currently "role" and
-- "location" on applications) so a value typed once is suggested again on
-- any device, alongside the hardcoded defaults in
-- src/lib/constants/fieldOptions.ts.
create table user_field_options (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) not null,
  field      text not null check (field in ('role', 'location')),
  value      text not null,
  created_at timestamptz default now() not null,
  unique (user_id, field, value)
);

alter table user_field_options enable row level security;

create policy "users_own_field_options"
  on user_field_options for all
  using (auth.uid() = user_id);
