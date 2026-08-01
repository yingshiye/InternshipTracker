-- Modular Resume Builder — Step 3.
--
-- Additive only. No existing migration file is edited, no table is dropped,
-- no privilege that Step 1/2 granted is widened. This migration adds:
--
--   1. `snapshot_schema_version` to newly-created version snapshots
--      (create_resume_version is REPLACED, not edited in place — old
--      snapshots on disk are never rewritten and are read as version 1).
--   2. restore_resume_from_version — the single atomic restore operation.
--   3. A same-user uniqueness target on resume_versions so an application
--      can carry a composite foreign key that is ownership-safe.
--   4. applications.submitted_resume_version_id + composite FK + a trigger
--      that blocks any write to that column outside the association RPC.
--   5. set_application_resume_version — the only association write path.
--
-- NOTE ON `public.applications`: the legacy `_create_applications.sql`
-- migration has a filename the Supabase CLI does not recognise (no
-- `<timestamp>_` prefix), so the CLI silently skips it and a *local*
-- database has no `applications` table. That file is protected and must
-- not be edited or renamed here. Everything in section (4) below is
-- therefore wrapped in an existence check: on a hosted project where the
-- table is real the DDL applies; on a local CLI database it is skipped and
-- the association RPC simply has no table to act on until the table
-- exists. The RPC body is late-bound plpgsql, so creating it is safe
-- either way.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. create_resume_version — now stamps snapshot_schema_version
-- ───────────────────────────────────────────────────────────────────────────
-- Identical to the Step 1 definition except for the added
-- 'snapshot_schema_version' key. Signature and return type are unchanged,
-- so this is a true CREATE OR REPLACE and not a new function. The client
-- still cannot supply a snapshot: no such parameter exists.

create or replace function create_resume_version(p_resume_id uuid, p_expected_revision integer, p_version_type text)
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

  -- `version_number` is qualified with the `rv` alias because it also names
  -- this function's RETURNS TABLE output column; an unqualified reference is
  -- ambiguous and Postgres refuses to guess.
  select coalesce(max(rv.version_number), 0) + 1 into v_next_version
    from public.resume_versions rv where rv.resume_id = p_resume_id;

  v_snapshot := v_snapshot || jsonb_build_object(
    'snapshot_schema_version', 1,
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

-- Re-assert the privilege set explicitly. CREATE OR REPLACE preserves the
-- existing ACL, but restating it keeps the grant audit self-contained and
-- guarantees the result does not depend on the prior state.
revoke execute on function public.create_resume_version(uuid, integer, text) from public;
revoke execute on function public.create_resume_version(uuid, integer, text) from anon;
revoke execute on function public.create_resume_version(uuid, integer, text) from authenticated;
revoke execute on function public.create_resume_version(uuid, integer, text) from service_role;
grant execute on function public.create_resume_version(uuid, integer, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. restore_resume_from_version
-- ───────────────────────────────────────────────────────────────────────────
-- One statement-level atomic operation: the whole restore happens inside a
-- single function call, so any failure (including a malformed snapshot
-- detected halfway through the section loop) rolls the entire restore back
-- and leaves the draft exactly as it was.
--
-- What is restored: header, sections, entries, bullets, plus style_settings
-- and target_length — those two are part of the stored snapshot and are what
-- make a restored draft actually look like the version. Deliberately NOT
-- restored: the resume's own name / target_company / target_role (renaming a
-- resume as a side effect of a restore would be surprising), and entry
-- source_block_id (the snapshot is a content-only record and does not carry
-- library identity, so restored entries are plain resume-specific entries
-- with no library link).
--
-- resume_versions rows are never touched, so every version — including the
-- one being restored from — survives the restore unchanged.

create function restore_resume_from_version(
  p_resume_id uuid,
  p_expected_revision integer,
  p_version_id uuid
)
returns integer
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_snapshot jsonb;
  v_version_resume_id uuid;
  v_header jsonb;
  v_resume jsonb;
  v_section jsonb;
  v_entry jsonb;
  v_bullet jsonb;
  v_new_section_id uuid;
  v_new_entry_id uuid;
  v_layout text;
  v_s_order integer := 0;
  v_e_order integer;
  v_b_order integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev
    from public.resumes r
    where r.id = p_resume_id and r.user_id = auth.uid()
    for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  -- Ownership and same-resume are checked in one lookup: a version owned by
  -- somebody else is indistinguishable from a version that does not exist,
  -- so cross-user probing learns nothing.
  select rv.snapshot, rv.resume_id into v_snapshot, v_version_resume_id
    from public.resume_versions rv
    where rv.id = p_version_id and rv.user_id = auth.uid();
  if not found then raise exception 'version_not_found'; end if;
  if v_version_resume_id <> p_resume_id then raise exception 'version_resume_mismatch'; end if;

  -- ── Snapshot validation ────────────────────────────────────────────────
  if v_snapshot is null
     or jsonb_typeof(v_snapshot) <> 'object'
     or jsonb_typeof(v_snapshot -> 'sections') <> 'array'
     or (v_snapshot ? 'header' and jsonb_typeof(v_snapshot -> 'header') not in ('object', 'null'))
     or (v_snapshot ? 'resume' and jsonb_typeof(v_snapshot -> 'resume') not in ('object', 'null'))
  then
    raise exception 'invalid_snapshot';
  end if;

  -- ── Replace the draft body ─────────────────────────────────────────────
  -- Deleting sections cascades to entries (composite FK) and from there to
  -- bullets, so this clears the whole body in one statement.
  delete from public.resume_sections where resume_id = p_resume_id;

  v_header := v_snapshot -> 'header';
  if v_header is null or jsonb_typeof(v_header) = 'null' then
    update public.resume_headers h
      set full_name = null, email = null, phone = null, location = null,
          linkedin_url = null, github_url = null, portfolio_url = null,
          custom_links = '{"links": []}'::jsonb
      where h.resume_id = p_resume_id;
  else
    update public.resume_headers h
      set full_name     = v_header ->> 'full_name',
          email         = v_header ->> 'email',
          phone         = v_header ->> 'phone',
          location      = v_header ->> 'location',
          linkedin_url  = v_header ->> 'linkedin_url',
          github_url    = v_header ->> 'github_url',
          portfolio_url = v_header ->> 'portfolio_url',
          custom_links  = case
                            when jsonb_typeof(v_header -> 'custom_links') = 'object'
                              then v_header -> 'custom_links'
                            else '{"links": []}'::jsonb
                          end
      where h.resume_id = p_resume_id;
  end if;
  if not found then
    -- create_resume always makes a header row, so this only covers a draft
    -- whose header was removed out of band.
    insert into public.resume_headers (resume_id, user_id) values (p_resume_id, auth.uid());
  end if;

  for v_section in select value from jsonb_array_elements(v_snapshot -> 'sections') loop
    if jsonb_typeof(v_section) <> 'object' then raise exception 'invalid_snapshot'; end if;
    v_layout := v_section ->> 'layout_kind';
    if v_layout is null or v_layout not in ('entry', 'education', 'skills') then
      raise exception 'invalid_snapshot';
    end if;
    if v_section ->> 'title' is null then raise exception 'invalid_snapshot'; end if;

    v_s_order := v_s_order + 1;
    insert into public.resume_sections (user_id, resume_id, title, layout_kind, sort_order)
      values (auth.uid(), p_resume_id, v_section ->> 'title', v_layout, v_s_order)
      returning id into v_new_section_id;

    if v_section ? 'entries' and jsonb_typeof(v_section -> 'entries') <> 'null' then
      if jsonb_typeof(v_section -> 'entries') <> 'array' then raise exception 'invalid_snapshot'; end if;
      v_e_order := 0;

      for v_entry in select value from jsonb_array_elements(v_section -> 'entries') loop
        if jsonb_typeof(v_entry) <> 'object' then raise exception 'invalid_snapshot'; end if;
        if (v_entry ? 'education_data' and jsonb_typeof(v_entry -> 'education_data') not in ('object', 'null'))
           or (v_entry ? 'skills_data' and jsonb_typeof(v_entry -> 'skills_data') not in ('object', 'null'))
        then
          raise exception 'invalid_snapshot';
        end if;

        v_e_order := v_e_order + 1;
        insert into public.resume_entries (
          user_id, resume_id, section_id, title, subtitle, organization, location,
          start_date, end_date, education_data, skills_data, sort_order
        ) values (
          auth.uid(), p_resume_id, v_new_section_id,
          v_entry ->> 'title', v_entry ->> 'subtitle', v_entry ->> 'organization', v_entry ->> 'location',
          nullif(v_entry ->> 'start_date', '')::date, nullif(v_entry ->> 'end_date', '')::date,
          case when jsonb_typeof(v_entry -> 'education_data') = 'object' then v_entry -> 'education_data' end,
          case when jsonb_typeof(v_entry -> 'skills_data') = 'object' then v_entry -> 'skills_data' end,
          v_e_order
        ) returning id into v_new_entry_id;

        if v_entry ? 'bullets' and jsonb_typeof(v_entry -> 'bullets') <> 'null' then
          if jsonb_typeof(v_entry -> 'bullets') <> 'array' then raise exception 'invalid_snapshot'; end if;
          v_b_order := 0;

          for v_bullet in select value from jsonb_array_elements(v_entry -> 'bullets') loop
            if jsonb_typeof(v_bullet) <> 'object' or v_bullet ->> 'content' is null then
              raise exception 'invalid_snapshot';
            end if;
            v_b_order := v_b_order + 1;
            insert into public.resume_entry_bullets (user_id, resume_id, entry_id, content, sort_order)
              values (auth.uid(), p_resume_id, v_new_entry_id, v_bullet ->> 'content', v_b_order);
          end loop;
        end if;
      end loop;
    end if;
  end loop;

  v_resume := v_snapshot -> 'resume';
  if v_resume is not null and jsonb_typeof(v_resume) = 'object' then
    update public.resumes r
      set style_settings = case
                             when jsonb_typeof(v_resume -> 'style_settings') = 'object'
                               then v_resume -> 'style_settings'
                             else r.style_settings
                           end,
          target_length  = case
                             when v_resume ->> 'target_length' in ('one_page', 'two_pages', 'no_limit')
                               then v_resume ->> 'target_length'
                             else r.target_length
                           end
      where r.id = p_resume_id;
  end if;

  -- Exactly one revision bump for the whole restore.
  update public.resumes r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return v_rev;
end;
$$;
revoke execute on function public.restore_resume_from_version(uuid, integer, uuid) from public;
revoke execute on function public.restore_resume_from_version(uuid, integer, uuid) from anon;
revoke execute on function public.restore_resume_from_version(uuid, integer, uuid) from authenticated;
revoke execute on function public.restore_resume_from_version(uuid, integer, uuid) from service_role;
grant execute on function public.restore_resume_from_version(uuid, integer, uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Same-user uniqueness target on resume_versions
-- ───────────────────────────────────────────────────────────────────────────
-- `id` alone is already unique, so this adds no new constraint on the data;
-- it exists purely so a composite foreign key can reference (user_id, id)
-- and thereby make "the version belongs to the same user as the row that
-- points at it" a database-enforced fact rather than an application promise.

alter table public.resume_versions
  add constraint resume_versions_user_id_id_key unique (user_id, id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. applications.submitted_resume_version_id
-- ───────────────────────────────────────────────────────────────────────────
-- Guarded: see the note at the top of this file. `applications` does not
-- exist on a local CLI database because the legacy migration that creates it
-- has an unrecognised filename and is skipped.

-- The trigger procedure is created first (it is table-independent) so the
-- guarded block below can always attach it.
create or replace function guard_application_resume_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.submitted_resume_version_id is not null
       and coalesce(current_setting('app.resume_version_assoc', true), '') <> 'on' then
      raise exception 'direct_version_association_not_allowed';
    end if;
    return new;
  end if;

  if new.submitted_resume_version_id is distinct from old.submitted_resume_version_id
     and coalesce(current_setting('app.resume_version_assoc', true), '') <> 'on' then
    raise exception 'direct_version_association_not_allowed';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_application_resume_version() from public, anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.applications') is null then
    raise notice 'public.applications not present — skipping Step 3 application-association DDL';
    return;
  end if;

  -- Additive nullable column. An application with no linked version keeps
  -- NULL; nothing about existing rows changes.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications'
      and column_name = 'submitted_resume_version_id'
  ) then
    execute 'alter table public.applications add column submitted_resume_version_id uuid';
  end if;

  -- Composite FK: same-user ownership is enforced by the database, not by
  -- application code. MATCH SIMPLE means the constraint is simply not
  -- checked while submitted_resume_version_id is NULL, which is what an
  -- unlinked application wants. ON DELETE RESTRICT rather than SET NULL
  -- because a composite SET NULL would also try to null user_id (NOT NULL);
  -- resume_versions rows cannot be deleted at all, so this never fires.
  if not exists (
    select 1 from pg_constraint
    where conname = 'applications_submitted_resume_version_fkey'
      and conrelid = 'public.applications'::regclass
  ) then
    execute 'alter table public.applications
               add constraint applications_submitted_resume_version_fkey
               foreign key (user_id, submitted_resume_version_id)
               references public.resume_versions (user_id, id)
               on delete restrict';
  end if;

  if not exists (
    select 1 from pg_class where relname = 'idx_applications_submitted_resume_version'
  ) then
    execute 'create index idx_applications_submitted_resume_version
               on public.applications (submitted_resume_version_id)';
  end if;

  -- Block any write to the association column that did not come from the
  -- association RPC. `applications` allows ordinary direct client CRUD
  -- (that is the pre-existing tracker design and Step 3 does not change
  -- it), so without this trigger a client could set the column directly
  -- and bypass the version-type and replacement-confirmation rules.
  if not exists (
    select 1 from pg_trigger
    where tgname = 'applications_guard_resume_version'
      and tgrelid = 'public.applications'::regclass
  ) then
    execute 'create trigger applications_guard_resume_version
               before insert or update on public.applications
               for each row execute procedure public.guard_application_resume_version()';
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. set_application_resume_version
-- ───────────────────────────────────────────────────────────────────────────
-- The only path that may write applications.submitted_resume_version_id.
-- The session flag it sets is transaction-local (set_config(..., true)), so
-- it cannot leak permission to any later statement or connection reuse.

create function set_application_resume_version(
  p_application_id uuid,
  p_resume_version_id uuid,
  p_confirm_replace boolean default false
)
returns boolean
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_existing uuid;
  v_version_type text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select a.submitted_resume_version_id into v_existing
    from public.applications a
    where a.id = p_application_id and a.user_id = auth.uid()
    for update;
  if not found then raise exception 'application_not_found'; end if;

  if p_resume_version_id is not null then
    -- Ownership check and existence check are the same lookup, so a version
    -- belonging to another user is reported exactly like a missing one.
    select rv.version_type into v_version_type
      from public.resume_versions rv
      where rv.id = p_resume_version_id and rv.user_id = auth.uid();
    if not found then raise exception 'version_not_found'; end if;
    if v_version_type <> 'submitted' then raise exception 'invalid_version_type'; end if;
  end if;

  -- Replacing an existing, different association is never silent.
  if v_existing is not null
     and v_existing is distinct from p_resume_version_id
     and not p_confirm_replace then
    raise exception 'replacement_not_confirmed';
  end if;

  perform set_config('app.resume_version_assoc', 'on', true);
  update public.applications a
    set submitted_resume_version_id = p_resume_version_id
    where a.id = p_application_id and a.user_id = auth.uid();
  perform set_config('app.resume_version_assoc', 'off', true);

  return true;
end;
$$;
revoke execute on function public.set_application_resume_version(uuid, uuid, boolean) from public;
revoke execute on function public.set_application_resume_version(uuid, uuid, boolean) from anon;
revoke execute on function public.set_application_resume_version(uuid, uuid, boolean) from authenticated;
revoke execute on function public.set_application_resume_version(uuid, uuid, boolean) from service_role;
grant execute on function public.set_application_resume_version(uuid, uuid, boolean) to authenticated;
