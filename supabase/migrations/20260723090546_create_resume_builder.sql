-- Modular Resume Builder — Step 1 schema.
-- Three content layers: master library (resume_library_blocks/bullets),
-- editable resume draft (resumes/resume_headers/resume_sections/
-- resume_entries/resume_entry_bullets), immutable versions (resume_versions).

create extension if not exists moddatetime schema extensions;

-- ─── Master library ────────────────────────────────────────────────────────

create table resume_library_blocks (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        references auth.users(id) not null,
  name                   text        not null,
  default_section_title  text        not null,
  layout_kind            text        not null
                                      check (layout_kind in ('entry', 'education', 'skills')),
  title                  text,
  subtitle                text,
  organization           text,
  location               text,
  start_date             date,
  end_date               date,
  education_data         jsonb       check (education_data is null or jsonb_typeof(education_data) = 'object'),
  skills_data            jsonb       check (skills_data is null or jsonb_typeof(skills_data) = 'object'),
  sort_order             integer     not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table resume_library_bullets (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) not null,
  block_id   uuid        references resume_library_blocks(id) on delete cascade not null,
  content    text        not null,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Editable resume draft ─────────────────────────────────────────────────

create table resumes (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) not null,
  name           text        not null,
  target_company text,
  target_role    text,
  style_settings jsonb       not null default '{}'::jsonb
                             check (jsonb_typeof(style_settings) = 'object'),
  target_length  text        not null default 'one_page'
                             check (target_length in ('one_page', 'two_pages', 'no_limit')),
  revision       integer     not null default 1,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table resume_headers (
  id            uuid        primary key default gen_random_uuid(),
  resume_id     uuid        references resumes(id) on delete cascade not null unique,
  user_id       uuid        references auth.users(id) not null,
  full_name     text,
  email         text,
  phone         text,
  location      text,
  linkedin_url  text,
  github_url    text,
  portfolio_url text,
  custom_links  jsonb       not null default '{"links": []}'::jsonb
                            check (jsonb_typeof(custom_links) = 'object'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table resume_sections (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) not null,
  resume_id   uuid        references resumes(id) on delete cascade not null,
  title       text        not null,
  layout_kind text        not null
                          check (layout_kind in ('entry', 'education', 'skills')),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, resume_id)
);

-- resume_id is denormalized (also reachable via section_id) so RLS/RPC
-- ownership checks never need a join; the composite FK below guarantees
-- section_id and resume_id can never disagree about which resume they
-- belong to, even for rows inserted outside these RPCs.
create table resume_entries (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        references auth.users(id) not null,
  resume_id               uuid        references resumes(id) on delete cascade not null,
  section_id              uuid        not null,
  source_block_id         uuid        references resume_library_blocks(id) on delete set null,
  source_block_updated_at timestamptz,
  title                   text,
  subtitle                text,
  organization            text,
  location                text,
  start_date              date,
  end_date                date,
  education_data          jsonb       check (education_data is null or jsonb_typeof(education_data) = 'object'),
  skills_data             jsonb       check (skills_data is null or jsonb_typeof(skills_data) = 'object'),
  sort_order              integer     not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (id, resume_id),
  foreign key (section_id, resume_id) references resume_sections (id, resume_id) on delete cascade
);

-- Same reasoning as resume_entries: resume_id is denormalized, and the
-- composite FK guarantees entry_id and resume_id always agree.
create table resume_entry_bullets (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users(id) not null,
  resume_id        uuid        references resumes(id) on delete cascade not null,
  entry_id         uuid        not null,
  source_bullet_id uuid        references resume_library_bullets(id) on delete set null,
  content          text        not null,
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (entry_id, resume_id) references resume_entries (id, resume_id) on delete cascade
);

-- ─── Immutable versions ─────────────────────────────────────────────────────

create table resume_versions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) not null,
  resume_id      uuid        references resumes(id) on delete restrict not null,
  version_number integer     not null,
  version_type   text        not null
                             check (version_type in ('manual', 'exported', 'submitted')),
  snapshot       jsonb       not null check (jsonb_typeof(snapshot) = 'object'),
  created_at     timestamptz not null default now(),
  unique (resume_id, version_number)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index idx_resume_library_blocks_user on resume_library_blocks (user_id);
create index idx_resume_library_bullets_user on resume_library_bullets (user_id);
create index idx_resume_library_bullets_block on resume_library_bullets (block_id);
create index idx_resumes_user on resumes (user_id);
create index idx_resume_headers_user on resume_headers (user_id);
create index idx_resume_sections_user on resume_sections (user_id);
create index idx_resume_sections_resume on resume_sections (resume_id);
create index idx_resume_entries_user on resume_entries (user_id);
create index idx_resume_entries_resume on resume_entries (resume_id);
create index idx_resume_entries_section on resume_entries (section_id, resume_id);
create index idx_resume_entries_source_block on resume_entries (source_block_id);
create index idx_resume_entry_bullets_user on resume_entry_bullets (user_id);
create index idx_resume_entry_bullets_resume on resume_entry_bullets (resume_id);
create index idx_resume_entry_bullets_entry on resume_entry_bullets (entry_id, resume_id);
create index idx_resume_entry_bullets_source_bullet on resume_entry_bullets (source_bullet_id);
create index idx_resume_versions_user on resume_versions (user_id);

-- ─── Explicit table privilege lockdown ─────────────────────────────────────
-- Local testing showed that a fresh Supabase CLI database's default ACLs
-- for objects created by the `postgres` role (which is what applies every
-- migration) do not necessarily match a hosted project's default grants,
-- and can include privileges like TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
-- that were never intentionally approved. Revoke everything on these 8
-- tables first, then grant back only exactly what's approved, so the
-- effective privilege set never depends on ambient default-ACL behavior.
-- This does not touch global or schema-wide default privileges — it is
-- scoped to these 8 tables only.

revoke all privileges on table
  public.resume_library_blocks,
  public.resume_library_bullets,
  public.resumes,
  public.resume_headers,
  public.resume_sections,
  public.resume_entries,
  public.resume_entry_bullets,
  public.resume_versions
from public, anon, authenticated, service_role;

-- Library tables: direct client CRUD remains allowed — these are not part
-- of the revision-gated draft, so RLS alone (below) is the right boundary.
grant select, insert, update, delete on table public.resume_library_blocks to authenticated;
grant select, insert, update, delete on table public.resume_library_bullets to authenticated;

-- Draft + version tables: read-only for authenticated. Every mutation goes
-- through a SECURITY DEFINER RPC below, which does not need — and does
-- not get — any table-level grant of its own (SECURITY DEFINER functions
-- execute with the function owner's privileges, not the caller's).
grant select on table public.resumes to authenticated;
grant select on table public.resume_headers to authenticated;
grant select on table public.resume_sections to authenticated;
grant select on table public.resume_entries to authenticated;
grant select on table public.resume_entry_bullets to authenticated;
grant select on table public.resume_versions to authenticated;

-- anon: nothing. service_role: nothing — no concrete Step 1 requirement
-- needs it, and SECURITY DEFINER functions don't need it either.

-- ─── Row-Level Security ─────────────────────────────────────────────────────

alter table resume_library_blocks enable row level security;
alter table resume_library_bullets enable row level security;
alter table resumes enable row level security;
alter table resume_headers enable row level security;
alter table resume_sections enable row level security;
alter table resume_entries enable row level security;
alter table resume_entry_bullets enable row level security;
alter table resume_versions enable row level security;

-- resume_library_blocks: root of the library, four functional policies.
create policy "resume_library_blocks_select" on resume_library_blocks
  for select using (auth.uid() = user_id);
create policy "resume_library_blocks_insert" on resume_library_blocks
  for insert with check (auth.uid() = user_id);
create policy "resume_library_blocks_update" on resume_library_blocks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resume_library_blocks_delete" on resume_library_blocks
  for delete using (auth.uid() = user_id);

-- resume_library_bullets: parent-ownership verified through block_id.
create policy "resume_library_bullets_select" on resume_library_bullets
  for select using (auth.uid() = user_id);
create policy "resume_library_bullets_insert" on resume_library_bullets
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from resume_library_blocks blk where blk.id = block_id and blk.user_id = auth.uid())
  );
create policy "resume_library_bullets_update" on resume_library_bullets
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (select 1 from resume_library_blocks blk where blk.id = block_id and blk.user_id = auth.uid())
  );
create policy "resume_library_bullets_delete" on resume_library_bullets
  for delete using (auth.uid() = user_id);

-- Draft tables: SELECT is functional (ownership-based); INSERT/UPDATE/
-- DELETE are unconditional denies. Direct table writes have no grant at
-- all (above), so these policies are never actually reached today — they
-- exist as a second, independent layer so that if a future migration ever
-- accidentally re-grants write privileges to authenticated, RLS still
-- blocks the operation regardless. All real mutation happens inside the
-- SECURITY DEFINER RPC functions further below.

create policy "resumes_select" on resumes for select using (auth.uid() = user_id);
create policy "resumes_deny_insert" on resumes for insert with check (false);
create policy "resumes_deny_update" on resumes for update using (false) with check (false);
create policy "resumes_deny_delete" on resumes for delete using (false);

create policy "resume_headers_select" on resume_headers for select using (auth.uid() = user_id);
create policy "resume_headers_deny_insert" on resume_headers for insert with check (false);
create policy "resume_headers_deny_update" on resume_headers for update using (false) with check (false);
create policy "resume_headers_deny_delete" on resume_headers for delete using (false);

create policy "resume_sections_select" on resume_sections for select using (auth.uid() = user_id);
create policy "resume_sections_deny_insert" on resume_sections for insert with check (false);
create policy "resume_sections_deny_update" on resume_sections for update using (false) with check (false);
create policy "resume_sections_deny_delete" on resume_sections for delete using (false);

create policy "resume_entries_select" on resume_entries for select using (auth.uid() = user_id);
create policy "resume_entries_deny_insert" on resume_entries for insert with check (false);
create policy "resume_entries_deny_update" on resume_entries for update using (false) with check (false);
create policy "resume_entries_deny_delete" on resume_entries for delete using (false);

create policy "resume_entry_bullets_select" on resume_entry_bullets for select using (auth.uid() = user_id);
create policy "resume_entry_bullets_deny_insert" on resume_entry_bullets for insert with check (false);
create policy "resume_entry_bullets_deny_update" on resume_entry_bullets for update using (false) with check (false);
create policy "resume_entry_bullets_deny_delete" on resume_entry_bullets for delete using (false);

-- resume_versions: SELECT is functional. INSERT is an unconditional deny —
-- the only path that can ever create a version is the SECURITY DEFINER
-- create_resume_version function below, which has no client-suppliable
-- snapshot parameter at all. No UPDATE/DELETE policy exists (unchanged) —
-- the trigger below is the role-independent guarantee for those, covering
-- even postgres/table-owner/any-bypass-RLS role, which an RLS false
-- policy structurally cannot do.
create policy "resume_versions_select" on resume_versions for select using (auth.uid() = user_id);
create policy "resume_versions_deny_insert" on resume_versions for insert with check (false);

-- ─── resume_versions immutability trigger ──────────────────────────────────

create or replace function reject_resume_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'resume_versions rows are immutable';
end;
$$;

-- Not exposed via the Data API at all — it's an internal trigger
-- procedure, never called directly by any client role.
revoke execute on function public.reject_resume_version_mutation() from public, anon, authenticated, service_role;

create trigger resume_versions_immutable
  before update or delete on resume_versions
  for each row execute procedure reject_resume_version_mutation();

-- ─── updated_at triggers ────────────────────────────────────────────────────

create trigger handle_updated_at_resume_library_blocks
  before update on resume_library_blocks
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_resume_library_bullets
  before update on resume_library_bullets
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_resumes
  before update on resumes
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_resume_headers
  before update on resume_headers
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_resume_sections
  before update on resume_sections
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_resume_entries
  before update on resume_entries
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at_resume_entry_bullets
  before update on resume_entry_bullets
  for each row execute procedure extensions.moddatetime(updated_at);

-- ─── RPC functions ──────────────────────────────────────────────────────────
-- Every function: SECURITY DEFINER, so it executes with the function
-- owner's (postgres's) privileges rather than the caller's — this is
-- required because authenticated now has no direct write grant on the
-- draft/version tables at all. RLS therefore does NOT apply inside these
-- functions; every ownership/parent/same-resume check below is an
-- explicit, mandatory predicate, not a redundant layer on top of RLS.
-- search_path is pinned to '' (empty) and every object reference is
-- schema-qualified, closing the search-path-hijack risk that matters much
-- more for SECURITY DEFINER than it would for SECURITY INVOKER. Every
-- function rejects auth.uid() is null before doing anything else. No
-- dynamic SQL is used anywhere. Execute privileges are locked down
-- explicitly per function: revoked from public, anon, authenticated, and
-- service_role individually (not relying on the default PUBLIC execute
-- grant Postgres applies to new functions), then granted back only to
-- authenticated for user-facing operations.
--
-- Three categories:
--   (1) not revision-checked      — create_resume, duplicate_resume
--   (2) revision-checked, no bump — create_resume_version, delete_resume
--   (3) revision-checked + bump   — every other draft-content mutation

-- (1) create_resume — no existing resume to conflict with yet.
create function create_resume(p_name text, p_target_company text default null, p_target_role text default null)
returns table(resume_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_new_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  insert into public.resumes (user_id, name, target_company, target_role)
    values (auth.uid(), p_name, p_target_company, p_target_role)
    returning id into v_new_id;

  insert into public.resume_headers (resume_id, user_id)
    values (v_new_id, auth.uid());

  return query select v_new_id, 1;
end;
$$;
revoke execute on function public.create_resume(text, text, text) from public;
revoke execute on function public.create_resume(text, text, text) from anon;
revoke execute on function public.create_resume(text, text, text) from authenticated;
revoke execute on function public.create_resume(text, text, text) from service_role;
grant execute on function public.create_resume(text, text, text) to authenticated;

-- (3) update_resume_metadata
create function update_resume_metadata(p_resume_id uuid, p_expected_revision integer,
    p_name text, p_target_company text, p_target_role text)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resumes set name = p_name, target_company = p_target_company, target_role = p_target_role,
      revision = revision + 1
    where id = p_resume_id;

  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.update_resume_metadata(uuid, integer, text, text, text) from public;
revoke execute on function public.update_resume_metadata(uuid, integer, text, text, text) from anon;
revoke execute on function public.update_resume_metadata(uuid, integer, text, text, text) from authenticated;
revoke execute on function public.update_resume_metadata(uuid, integer, text, text, text) from service_role;
grant execute on function public.update_resume_metadata(uuid, integer, text, text, text) to authenticated;

-- (3) update_resume_style
create function update_resume_style(p_resume_id uuid, p_expected_revision integer, p_style_settings jsonb)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resumes set style_settings = p_style_settings, revision = revision + 1 where id = p_resume_id;

  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.update_resume_style(uuid, integer, jsonb) from public;
revoke execute on function public.update_resume_style(uuid, integer, jsonb) from anon;
revoke execute on function public.update_resume_style(uuid, integer, jsonb) from authenticated;
revoke execute on function public.update_resume_style(uuid, integer, jsonb) from service_role;
grant execute on function public.update_resume_style(uuid, integer, jsonb) to authenticated;

-- (3) update_resume_target_length
create function update_resume_target_length(p_resume_id uuid, p_expected_revision integer, p_target_length text)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resumes set target_length = p_target_length, revision = revision + 1 where id = p_resume_id;

  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.update_resume_target_length(uuid, integer, text) from public;
revoke execute on function public.update_resume_target_length(uuid, integer, text) from anon;
revoke execute on function public.update_resume_target_length(uuid, integer, text) from authenticated;
revoke execute on function public.update_resume_target_length(uuid, integer, text) from service_role;
grant execute on function public.update_resume_target_length(uuid, integer, text) to authenticated;

-- (3) set_resume_archived
create function set_resume_archived(p_resume_id uuid, p_expected_revision integer, p_archived boolean)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resumes set archived_at = case when p_archived then now() else null end, revision = revision + 1
    where id = p_resume_id;

  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.set_resume_archived(uuid, integer, boolean) from public;
revoke execute on function public.set_resume_archived(uuid, integer, boolean) from anon;
revoke execute on function public.set_resume_archived(uuid, integer, boolean) from authenticated;
revoke execute on function public.set_resume_archived(uuid, integer, boolean) from service_role;
grant execute on function public.set_resume_archived(uuid, integer, boolean) to authenticated;

-- (3) update_resume_header
create function update_resume_header(p_resume_id uuid, p_expected_revision integer,
    p_full_name text, p_email text, p_phone text, p_location text,
    p_linkedin_url text, p_github_url text, p_portfolio_url text, p_custom_links jsonb)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resume_headers set
      full_name = p_full_name, email = p_email, phone = p_phone, location = p_location,
      linkedin_url = p_linkedin_url, github_url = p_github_url, portfolio_url = p_portfolio_url,
      custom_links = p_custom_links
    where resume_id = p_resume_id;
  if not found then raise exception 'header_not_found'; end if;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.update_resume_header(uuid, integer, text, text, text, text, text, text, text, jsonb) from public;
revoke execute on function public.update_resume_header(uuid, integer, text, text, text, text, text, text, text, jsonb) from anon;
revoke execute on function public.update_resume_header(uuid, integer, text, text, text, text, text, text, text, jsonb) from authenticated;
revoke execute on function public.update_resume_header(uuid, integer, text, text, text, text, text, text, text, jsonb) from service_role;
grant execute on function public.update_resume_header(uuid, integer, text, text, text, text, text, text, text, jsonb) to authenticated;

-- (2) delete_resume — no bump: the row is gone, nothing left to increment.
create function delete_resume(p_resume_id uuid, p_expected_revision integer)
returns table(deleted boolean)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  begin
    delete from public.resumes where id = p_resume_id;
  exception when foreign_key_violation then
    raise exception 'has_versions';
  end;

  return query select true;
end;
$$;
revoke execute on function public.delete_resume(uuid, integer) from public;
revoke execute on function public.delete_resume(uuid, integer) from anon;
revoke execute on function public.delete_resume(uuid, integer) from authenticated;
revoke execute on function public.delete_resume(uuid, integer) from service_role;
grant execute on function public.delete_resume(uuid, integer) to authenticated;

-- (1) duplicate_resume — FOR SHARE, not FOR UPDATE: only reads the source,
-- but still blocks any concurrent mutation (which all take FOR UPDATE)
-- from starting on the source or any of its children for the duration of
-- this read, while still allowing other concurrent readers to proceed.
create function duplicate_resume(p_source_resume_id uuid, p_new_name text default null)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_source public.resumes%rowtype;
  v_new_resume_id uuid;
  v_old_section public.resume_sections%rowtype;
  v_new_section_id uuid;
  v_old_entry public.resume_entries%rowtype;
  v_new_entry_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_source from public.resumes where id = p_source_resume_id and user_id = auth.uid() for share;
  if not found then raise exception 'resume_not_found'; end if;

  insert into public.resumes (user_id, name, target_company, target_role, style_settings, target_length, revision, archived_at)
    values (auth.uid(), coalesce(p_new_name, v_source.name || ' (Copy)'), v_source.target_company, v_source.target_role,
            v_source.style_settings, v_source.target_length, 1, null)
    returning id into v_new_resume_id;

  insert into public.resume_headers (resume_id, user_id, full_name, email, phone, location, linkedin_url, github_url, portfolio_url, custom_links)
    select v_new_resume_id, auth.uid(), h.full_name, h.email, h.phone, h.location,
           h.linkedin_url, h.github_url, h.portfolio_url, h.custom_links
    from public.resume_headers h where h.resume_id = p_source_resume_id;

  for v_old_section in select * from public.resume_sections where resume_id = p_source_resume_id order by sort_order loop
    insert into public.resume_sections (user_id, resume_id, title, layout_kind, sort_order)
      values (auth.uid(), v_new_resume_id, v_old_section.title, v_old_section.layout_kind, v_old_section.sort_order)
      returning id into v_new_section_id;

    for v_old_entry in select * from public.resume_entries where section_id = v_old_section.id order by sort_order loop
      insert into public.resume_entries (user_id, resume_id, section_id, source_block_id, source_block_updated_at,
          title, subtitle, organization, location, start_date, end_date, education_data, skills_data, sort_order)
        values (auth.uid(), v_new_resume_id, v_new_section_id, v_old_entry.source_block_id, v_old_entry.source_block_updated_at,
          v_old_entry.title, v_old_entry.subtitle, v_old_entry.organization, v_old_entry.location,
          v_old_entry.start_date, v_old_entry.end_date, v_old_entry.education_data, v_old_entry.skills_data, v_old_entry.sort_order)
        returning id into v_new_entry_id;

      insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
        select auth.uid(), v_new_resume_id, v_new_entry_id, source_bullet_id, content, sort_order
        from public.resume_entry_bullets where entry_id = v_old_entry.id order by sort_order;
    end loop;
  end loop;

  return v_new_resume_id;
end;
$$;
revoke execute on function public.duplicate_resume(uuid, text) from public;
revoke execute on function public.duplicate_resume(uuid, text) from anon;
revoke execute on function public.duplicate_resume(uuid, text) from authenticated;
revoke execute on function public.duplicate_resume(uuid, text) from service_role;
grant execute on function public.duplicate_resume(uuid, text) to authenticated;

-- (3) create_section
create function create_section(p_resume_id uuid, p_expected_revision integer, p_title text, p_layout_kind text)
returns table(section_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_new_id uuid;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  -- `revision` is qualified with the `r` alias throughout this function
  -- because it also names this function's RETURNS TABLE output column —
  -- an unqualified reference is ambiguous between the two and Postgres
  -- (correctly) refuses to guess.
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_sections where resume_id = p_resume_id;

  insert into public.resume_sections (user_id, resume_id, title, layout_kind, sort_order)
    values (auth.uid(), p_resume_id, p_title, p_layout_kind, v_sort)
    returning id into v_new_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;

  return query select v_new_id, v_rev;
end;
$$;
revoke execute on function public.create_section(uuid, integer, text, text) from public;
revoke execute on function public.create_section(uuid, integer, text, text) from anon;
revoke execute on function public.create_section(uuid, integer, text, text) from authenticated;
revoke execute on function public.create_section(uuid, integer, text, text) from service_role;
grant execute on function public.create_section(uuid, integer, text, text) to authenticated;

-- (3) rename_section
create function rename_section(p_resume_id uuid, p_expected_revision integer, p_section_id uuid, p_title text)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resume_sections set title = p_title
    where id = p_section_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'section_not_found'; end if;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.rename_section(uuid, integer, uuid, text) from public;
revoke execute on function public.rename_section(uuid, integer, uuid, text) from anon;
revoke execute on function public.rename_section(uuid, integer, uuid, text) from authenticated;
revoke execute on function public.rename_section(uuid, integer, uuid, text) from service_role;
grant execute on function public.rename_section(uuid, integer, uuid, text) to authenticated;

-- (3) delete_section — only allowed while empty.
create function delete_section(p_resume_id uuid, p_expected_revision integer, p_section_id uuid)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  if not exists (select 1 from public.resume_sections where id = p_section_id and resume_id = p_resume_id and user_id = auth.uid()) then
    raise exception 'section_not_found';
  end if;

  if exists (select 1 from public.resume_entries where section_id = p_section_id) then
    raise exception 'section_not_empty';
  end if;

  delete from public.resume_sections where id = p_section_id;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.delete_section(uuid, integer, uuid) from public;
revoke execute on function public.delete_section(uuid, integer, uuid) from anon;
revoke execute on function public.delete_section(uuid, integer, uuid) from authenticated;
revoke execute on function public.delete_section(uuid, integer, uuid) from service_role;
grant execute on function public.delete_section(uuid, integer, uuid) to authenticated;

-- (3) reorder_sections
create function reorder_sections(p_resume_id uuid, p_expected_revision integer, p_ordered_section_ids uuid[])
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  i integer;
  v_len integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  v_len := coalesce(array_length(p_ordered_section_ids, 1), 0);

  if (select count(*) from public.resume_sections where resume_id = p_resume_id) <> v_len
     or (v_len > 0 and exists (
       select 1 from unnest(p_ordered_section_ids) as sid
       where not exists (select 1 from public.resume_sections s where s.id = sid and s.resume_id = p_resume_id)
     ))
  then
    raise exception 'invalid_reorder_set';
  end if;

  for i in 1..v_len loop
    update public.resume_sections set sort_order = i where id = p_ordered_section_ids[i];
  end loop;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.reorder_sections(uuid, integer, uuid[]) from public;
revoke execute on function public.reorder_sections(uuid, integer, uuid[]) from anon;
revoke execute on function public.reorder_sections(uuid, integer, uuid[]) from authenticated;
revoke execute on function public.reorder_sections(uuid, integer, uuid[]) from service_role;
grant execute on function public.reorder_sections(uuid, integer, uuid[]) to authenticated;

-- (3) copy_block_into_section
create function copy_block_into_section(p_resume_id uuid, p_expected_revision integer,
    p_section_id uuid, p_block_id uuid, p_bullet_ids uuid[])
returns table(entry_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_section_layout text;
  v_block public.resume_library_blocks%rowtype;
  v_new_entry_id uuid;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  -- `revision` is qualified with the `r` alias throughout this function
  -- because it also names this function's RETURNS TABLE output column —
  -- an unqualified reference is ambiguous between the two and Postgres
  -- (correctly) refuses to guess.
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select layout_kind into v_section_layout from public.resume_sections
    where id = p_section_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'section_not_found'; end if;

  select * into v_block from public.resume_library_blocks where id = p_block_id and user_id = auth.uid();
  if not found then raise exception 'source_not_found'; end if;

  if v_section_layout != v_block.layout_kind then raise exception 'layout_kind_mismatch'; end if;

  if coalesce(array_length(p_bullet_ids, 1), 0) > 0
     and exists (
       select 1 from unnest(p_bullet_ids) as bid
       where not exists (
         select 1 from public.resume_library_bullets lb
         where lb.id = bid and lb.block_id = p_block_id and lb.user_id = auth.uid()
       )
     )
  then
    raise exception 'source_bullet_not_found';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_entries where section_id = p_section_id;

  insert into public.resume_entries (user_id, resume_id, section_id, source_block_id, source_block_updated_at,
      title, subtitle, organization, location, start_date, end_date, education_data, skills_data, sort_order)
    values (auth.uid(), p_resume_id, p_section_id, v_block.id, v_block.updated_at,
      v_block.title, v_block.subtitle, v_block.organization, v_block.location, v_block.start_date, v_block.end_date,
      v_block.education_data, v_block.skills_data, v_sort)
    returning id into v_new_entry_id;

  if coalesce(array_length(p_bullet_ids, 1), 0) > 0 then
    insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
      select auth.uid(), p_resume_id, v_new_entry_id, lb.id, lb.content, row_number() over (order by lb.sort_order)
      from public.resume_library_bullets lb
      where lb.id = any(p_bullet_ids) and lb.block_id = p_block_id and lb.user_id = auth.uid();
  end if;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;

  return query select v_new_entry_id, v_rev;
end;
$$;
revoke execute on function public.copy_block_into_section(uuid, integer, uuid, uuid, uuid[]) from public;
revoke execute on function public.copy_block_into_section(uuid, integer, uuid, uuid, uuid[]) from anon;
revoke execute on function public.copy_block_into_section(uuid, integer, uuid, uuid, uuid[]) from authenticated;
revoke execute on function public.copy_block_into_section(uuid, integer, uuid, uuid, uuid[]) from service_role;
grant execute on function public.copy_block_into_section(uuid, integer, uuid, uuid, uuid[]) to authenticated;

-- (3) update_entry
create function update_entry(p_resume_id uuid, p_expected_revision integer, p_entry_id uuid,
    p_title text, p_subtitle text, p_organization text, p_location text,
    p_start_date date, p_end_date date, p_education_data jsonb, p_skills_data jsonb)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resume_entries set
      title = p_title, subtitle = p_subtitle, organization = p_organization, location = p_location,
      start_date = p_start_date, end_date = p_end_date, education_data = p_education_data, skills_data = p_skills_data
    where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.update_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from public;
revoke execute on function public.update_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from anon;
revoke execute on function public.update_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from authenticated;
revoke execute on function public.update_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from service_role;
grant execute on function public.update_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) to authenticated;

-- (3) remove_entry
create function remove_entry(p_resume_id uuid, p_expected_revision integer, p_entry_id uuid)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  delete from public.resume_entries where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.remove_entry(uuid, integer, uuid) from public;
revoke execute on function public.remove_entry(uuid, integer, uuid) from anon;
revoke execute on function public.remove_entry(uuid, integer, uuid) from authenticated;
revoke execute on function public.remove_entry(uuid, integer, uuid) from service_role;
grant execute on function public.remove_entry(uuid, integer, uuid) to authenticated;

-- (3) move_entry
create function move_entry(p_resume_id uuid, p_expected_revision integer, p_entry_id uuid, p_target_section_id uuid)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_old_section_id uuid;
  v_old_layout text;
  v_target_layout text;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select section_id into v_old_section_id from public.resume_entries
    where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;

  select layout_kind into v_old_layout from public.resume_sections where id = v_old_section_id;
  select layout_kind into v_target_layout from public.resume_sections
    where id = p_target_section_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'section_not_found'; end if;

  if v_old_layout != v_target_layout then raise exception 'layout_kind_mismatch'; end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_entries where section_id = p_target_section_id;

  update public.resume_entries set section_id = p_target_section_id, sort_order = v_sort where id = p_entry_id;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.move_entry(uuid, integer, uuid, uuid) from public;
revoke execute on function public.move_entry(uuid, integer, uuid, uuid) from anon;
revoke execute on function public.move_entry(uuid, integer, uuid, uuid) from authenticated;
revoke execute on function public.move_entry(uuid, integer, uuid, uuid) from service_role;
grant execute on function public.move_entry(uuid, integer, uuid, uuid) to authenticated;

-- (3) reorder_entries
create function reorder_entries(p_resume_id uuid, p_expected_revision integer, p_section_id uuid, p_ordered_entry_ids uuid[])
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  i integer;
  v_len integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  if not exists (select 1 from public.resume_sections where id = p_section_id and resume_id = p_resume_id and user_id = auth.uid()) then
    raise exception 'section_not_found';
  end if;

  v_len := coalesce(array_length(p_ordered_entry_ids, 1), 0);

  if (select count(*) from public.resume_entries where section_id = p_section_id) <> v_len
     or (v_len > 0 and exists (
       select 1 from unnest(p_ordered_entry_ids) as eid
       where not exists (select 1 from public.resume_entries e where e.id = eid and e.section_id = p_section_id and e.resume_id = p_resume_id)
     ))
  then
    raise exception 'invalid_reorder_set';
  end if;

  for i in 1..v_len loop
    update public.resume_entries set sort_order = i where id = p_ordered_entry_ids[i];
  end loop;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.reorder_entries(uuid, integer, uuid, uuid[]) from public;
revoke execute on function public.reorder_entries(uuid, integer, uuid, uuid[]) from anon;
revoke execute on function public.reorder_entries(uuid, integer, uuid, uuid[]) from authenticated;
revoke execute on function public.reorder_entries(uuid, integer, uuid, uuid[]) from service_role;
grant execute on function public.reorder_entries(uuid, integer, uuid, uuid[]) to authenticated;

-- (3) update_entry_bullet
create function update_entry_bullet(p_resume_id uuid, p_expected_revision integer, p_bullet_id uuid, p_content text)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  update public.resume_entry_bullets set content = p_content
    where id = p_bullet_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'bullet_not_found'; end if;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.update_entry_bullet(uuid, integer, uuid, text) from public;
revoke execute on function public.update_entry_bullet(uuid, integer, uuid, text) from anon;
revoke execute on function public.update_entry_bullet(uuid, integer, uuid, text) from authenticated;
revoke execute on function public.update_entry_bullet(uuid, integer, uuid, text) from service_role;
grant execute on function public.update_entry_bullet(uuid, integer, uuid, text) to authenticated;

-- (3) remove_entry_bullet
create function remove_entry_bullet(p_resume_id uuid, p_expected_revision integer, p_bullet_id uuid)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  delete from public.resume_entry_bullets where id = p_bullet_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'bullet_not_found'; end if;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.remove_entry_bullet(uuid, integer, uuid) from public;
revoke execute on function public.remove_entry_bullet(uuid, integer, uuid) from anon;
revoke execute on function public.remove_entry_bullet(uuid, integer, uuid) from authenticated;
revoke execute on function public.remove_entry_bullet(uuid, integer, uuid) from service_role;
grant execute on function public.remove_entry_bullet(uuid, integer, uuid) to authenticated;

-- (3) reorder_entry_bullets
create function reorder_entry_bullets(p_resume_id uuid, p_expected_revision integer, p_entry_id uuid, p_ordered_bullet_ids uuid[])
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  i integer;
  v_len integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  if not exists (select 1 from public.resume_entries where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid()) then
    raise exception 'entry_not_found';
  end if;

  v_len := coalesce(array_length(p_ordered_bullet_ids, 1), 0);

  if (select count(*) from public.resume_entry_bullets where entry_id = p_entry_id) <> v_len
     or (v_len > 0 and exists (
       select 1 from unnest(p_ordered_bullet_ids) as bid
       where not exists (select 1 from public.resume_entry_bullets b where b.id = bid and b.entry_id = p_entry_id and b.resume_id = p_resume_id)
     ))
  then
    raise exception 'invalid_reorder_set';
  end if;

  for i in 1..v_len loop
    update public.resume_entry_bullets set sort_order = i where id = p_ordered_bullet_ids[i];
  end loop;

  update public.resumes set revision = revision + 1 where id = p_resume_id;
  select revision into v_rev from public.resumes where id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.reorder_entry_bullets(uuid, integer, uuid, uuid[]) from public;
revoke execute on function public.reorder_entry_bullets(uuid, integer, uuid, uuid[]) from anon;
revoke execute on function public.reorder_entry_bullets(uuid, integer, uuid, uuid[]) from authenticated;
revoke execute on function public.reorder_entry_bullets(uuid, integer, uuid, uuid[]) from service_role;
grant execute on function public.reorder_entry_bullets(uuid, integer, uuid, uuid[]) to authenticated;

-- (3) add_bullet_from_library — only from the entry's own source_block_id.
create function add_bullet_from_library(p_resume_id uuid, p_expected_revision integer, p_entry_id uuid, p_library_bullet_id uuid)
returns table(bullet_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_source_block_id uuid;
  v_bullet public.resume_library_bullets%rowtype;
  v_new_bullet_id uuid;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  -- `revision` is qualified with the `r` alias throughout this function
  -- because it also names this function's RETURNS TABLE output column —
  -- an unqualified reference is ambiguous between the two and Postgres
  -- (correctly) refuses to guess.
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select source_block_id into v_source_block_id from public.resume_entries
    where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;
  if v_source_block_id is null then raise exception 'no_source_block'; end if;

  select * into v_bullet from public.resume_library_bullets
    where id = p_library_bullet_id and block_id = v_source_block_id and user_id = auth.uid();
  if not found then raise exception 'source_bullet_not_found'; end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_entry_bullets where entry_id = p_entry_id;

  insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
    values (auth.uid(), p_resume_id, p_entry_id, v_bullet.id, v_bullet.content, v_sort)
    returning id into v_new_bullet_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;

  return query select v_new_bullet_id, v_rev;
end;
$$;
revoke execute on function public.add_bullet_from_library(uuid, integer, uuid, uuid) from public;
revoke execute on function public.add_bullet_from_library(uuid, integer, uuid, uuid) from anon;
revoke execute on function public.add_bullet_from_library(uuid, integer, uuid, uuid) from authenticated;
revoke execute on function public.add_bullet_from_library(uuid, integer, uuid, uuid) from service_role;
grant execute on function public.add_bullet_from_library(uuid, integer, uuid, uuid) to authenticated;

-- (2) create_resume_version — snapshot built entirely server-side; the
-- client cannot supply one (no such parameter exists). One timestamp
-- (v_created_at) is computed once and used for both the embedded
-- snapshot field and the table row's created_at column.
create function create_resume_version(p_resume_id uuid, p_expected_revision integer, p_version_type text)
returns table(version_id uuid, version_number integer, created_at timestamptz)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_next_version integer;
  v_snapshot jsonb;
  v_new_version_id uuid;
  v_created_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select revision into v_rev from public.resumes where id = p_resume_id and user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select jsonb_build_object(
    'resume', jsonb_build_object('name', r.name, 'target_company', r.target_company,
        'target_role', r.target_role, 'style_settings', r.style_settings, 'target_length', r.target_length),
    'header', (select jsonb_build_object('full_name', h.full_name, 'email', h.email, 'phone', h.phone,
        'location', h.location, 'linkedin_url', h.linkedin_url, 'github_url', h.github_url,
        'portfolio_url', h.portfolio_url, 'custom_links', h.custom_links)
      from public.resume_headers h where h.resume_id = r.id),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', s.title, 'layout_kind', s.layout_kind, 'sort_order', s.sort_order,
        'entries', (select coalesce(jsonb_agg(jsonb_build_object(
            'title', e.title, 'subtitle', e.subtitle, 'organization', e.organization,
            'location', e.location, 'start_date', e.start_date, 'end_date', e.end_date,
            'education_data', e.education_data, 'skills_data', e.skills_data, 'sort_order', e.sort_order,
            'bullets', (select coalesce(jsonb_agg(jsonb_build_object('content', b.content, 'sort_order', b.sort_order)
                order by b.sort_order), '[]'::jsonb)
              from public.resume_entry_bullets b where b.entry_id = e.id)
          ) order by e.sort_order), '[]'::jsonb)
          from public.resume_entries e where e.section_id = s.id)
      ) order by s.sort_order), '[]'::jsonb)
      from public.resume_sections s where s.resume_id = r.id)
  ) into v_snapshot
  from public.resumes r where r.id = p_resume_id;

  -- `version_number` is qualified with the `rv` alias because it also
  -- names this function's RETURNS TABLE output column, exactly the same
  -- ambiguity class as the `revision` fix in create_section /
  -- copy_block_into_section / add_bullet_from_library above.
  select coalesce(max(rv.version_number), 0) + 1 into v_next_version
    from public.resume_versions rv where rv.resume_id = p_resume_id;

  v_snapshot := v_snapshot || jsonb_build_object(
    'draft_revision', v_rev,
    'version_number', v_next_version,
    'version_type', p_version_type,
    'created_at', v_created_at
  );

  insert into public.resume_versions (user_id, resume_id, version_number, version_type, snapshot, created_at)
  values (auth.uid(), p_resume_id, v_next_version, p_version_type, v_snapshot, v_created_at)
  returning id into v_new_version_id;

  return query select v_new_version_id, v_next_version, v_created_at;
end;
$$;
revoke execute on function public.create_resume_version(uuid, integer, text) from public;
revoke execute on function public.create_resume_version(uuid, integer, text) from anon;
revoke execute on function public.create_resume_version(uuid, integer, text) from authenticated;
revoke execute on function public.create_resume_version(uuid, integer, text) from service_role;
grant execute on function public.create_resume_version(uuid, integer, text) to authenticated;
