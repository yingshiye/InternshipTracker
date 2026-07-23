-- ─── url_snapshots ───────────────────────────────────────────────────────────
-- Global URL snapshot store (no user ownership).
-- RLS is enabled with zero policies: anon/authenticated clients get no
-- access at all (even though they hold default table grants), while the
-- service_role key used by the cron route bypasses RLS entirely. This is
-- the only way to reach this table.
create table url_snapshots (
  id            uuid primary key default gen_random_uuid(),
  url           text unique not null,
  content_hash  text,
  last_checked  timestamptz,
  created_at    timestamptz default now() not null
);

alter table url_snapshots enable row level security;

-- ─── user_watchlist ──────────────────────────────────────────────────────────
-- Per-user watchlist (RLS enabled)
-- has_changes is the only per-user "seen" state; it is set to true by the
-- cron job when url_snapshots.content_hash changes for this row's url, and
-- cleared by the user via "mark as seen". No hash value needs to round-trip
-- through the client, so the client never needs to read url_snapshots.
create table user_watchlist (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) not null,
  url            text not null,
  company        text not null,
  has_changes    boolean default false not null,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  unique (user_id, url)
);

alter table user_watchlist enable row level security;

create policy "users_own_watchlist"
  on user_watchlist for all
  using (auth.uid() = user_id);

create trigger handle_watchlist_updated_at
  before update on user_watchlist
  for each row execute procedure extensions.moddatetime(updated_at);
