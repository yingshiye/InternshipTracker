-- ─── url_snapshots ───────────────────────────────────────────────────────────
-- Global URL snapshot store (no user ownership, no RLS)
-- Only written to by the cron job via service role key
create table url_snapshots (
  id            uuid primary key default gen_random_uuid(),
  url           text unique not null,
  content_hash  text,
  last_checked  timestamptz,
  created_at    timestamptz default now() not null
);

-- ─── user_watchlist ──────────────────────────────────────────────────────────
-- Per-user watchlist (RLS enabled)
create table user_watchlist (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) not null,
  url            text not null,
  company        text not null,
  notified_hash  text,
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
