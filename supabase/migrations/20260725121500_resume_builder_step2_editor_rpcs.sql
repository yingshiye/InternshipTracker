-- Modular Resume Builder — Step 2 editor RPCs.
--
-- Additive migration: 8 new SECURITY DEFINER functions that power the visual
-- editor. No table, column, index, RLS, trigger, or grant changes — the
-- Step 1 schema and privilege model are unchanged. Every function here
-- follows the exact Step 1 conventions:
--   * security definer + set search_path = '' + fully public.-qualified names
--   * raise 'not_authenticated' when auth.uid() is null
--   * SELECT ... FOR UPDATE lock on the owning resumes row
--   * expected-revision check → 'revision_conflict'
--   * exactly one revision bump per successful draft mutation
--   * no dynamic SQL; narrow typed results
--   * revoke execute from public/anon/authenticated/service_role by exact
--     signature, then grant execute only to authenticated
--
-- Functions whose RETURNS TABLE exposes a `revision` output column qualify
-- every resumes.revision reference as `r.revision` — an unqualified
-- reference is ambiguous between the column and the output parameter and
-- Postgres refuses to guess (learned the hard way in Step 1).

-- ─── (1) add_custom_entry ───────────────────────────────────────────────────
-- Creates a resume-specific entry with source_block_id = null. The section's
-- layout_kind dictates which content fields are allowed: JSON payloads that
-- don't belong to the section layout are rejected.
create function add_custom_entry(
  p_resume_id uuid, p_expected_revision integer, p_section_id uuid,
  p_title text, p_subtitle text, p_organization text, p_location text,
  p_start_date date, p_end_date date, p_education_data jsonb, p_skills_data jsonb)
returns table(entry_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_layout text;
  v_new_entry_id uuid;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select layout_kind into v_layout from public.resume_sections
    where id = p_section_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'section_not_found'; end if;

  -- Only content appropriate to the section layout may be supplied.
  if v_layout = 'entry' and (p_education_data is not null or p_skills_data is not null) then
    raise exception 'layout_kind_mismatch';
  elsif v_layout = 'education' and p_skills_data is not null then
    raise exception 'layout_kind_mismatch';
  elsif v_layout = 'skills' and p_education_data is not null then
    raise exception 'layout_kind_mismatch';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_entries where section_id = p_section_id;

  insert into public.resume_entries (user_id, resume_id, section_id, source_block_id, source_block_updated_at,
      title, subtitle, organization, location, start_date, end_date, education_data, skills_data, sort_order)
    values (auth.uid(), p_resume_id, p_section_id, null, null,
      p_title, p_subtitle, p_organization, p_location, p_start_date, p_end_date,
      p_education_data, p_skills_data, v_sort)
    returning id into v_new_entry_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_new_entry_id, v_rev;
end;
$$;
revoke execute on function public.add_custom_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from public;
revoke execute on function public.add_custom_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from anon;
revoke execute on function public.add_custom_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from authenticated;
revoke execute on function public.add_custom_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) from service_role;
grant execute on function public.add_custom_entry(uuid, integer, uuid, text, text, text, text, date, date, jsonb, jsonb) to authenticated;

-- ─── (2) add_custom_bullet ──────────────────────────────────────────────────
create function add_custom_bullet(p_resume_id uuid, p_expected_revision integer, p_entry_id uuid, p_content text)
returns table(bullet_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_new_bullet_id uuid;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  if not exists (select 1 from public.resume_entries
      where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid()) then
    raise exception 'entry_not_found';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_entry_bullets where entry_id = p_entry_id;

  insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
    values (auth.uid(), p_resume_id, p_entry_id, null, p_content, v_sort)
    returning id into v_new_bullet_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_new_bullet_id, v_rev;
end;
$$;
revoke execute on function public.add_custom_bullet(uuid, integer, uuid, text) from public;
revoke execute on function public.add_custom_bullet(uuid, integer, uuid, text) from anon;
revoke execute on function public.add_custom_bullet(uuid, integer, uuid, text) from authenticated;
revoke execute on function public.add_custom_bullet(uuid, integer, uuid, text) from service_role;
grant execute on function public.add_custom_bullet(uuid, integer, uuid, text) to authenticated;

-- ─── (3) apply_library_update ───────────────────────────────────────────────
-- Atomically syncs selected library changes into a resume entry. All content
-- is read authoritatively from the library inside this function; the client
-- supplies only ids and field names. Unselected resume-specific edits are
-- preserved. If any selected update/add targets a source that no longer
-- exists, the whole transaction is rejected so the client must re-diff.
create function apply_library_update(
  p_resume_id uuid, p_expected_revision integer, p_entry_id uuid,
  p_apply_fields text[], p_update_bullet_ids uuid[], p_add_library_bullet_ids uuid[],
  p_remove_bullet_ids uuid[], p_confirm_removals boolean)
returns table(revision integer, fields_applied integer, bullets_updated integer,
  bullets_added integer, bullets_removed integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_block public.resume_library_blocks%rowtype;
  v_apply text[] := coalesce(p_apply_fields, array[]::text[]);
  v_update uuid[] := coalesce(p_update_bullet_ids, array[]::uuid[]);
  v_add uuid[] := coalesce(p_add_library_bullet_ids, array[]::uuid[]);
  v_remove uuid[] := coalesce(p_remove_bullet_ids, array[]::uuid[]);
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  -- Entry must exist and still be linked to a library block.
  perform 1 from public.resume_entries
    where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;

  select b.* into v_block from public.resume_library_blocks b
    where b.id = (select source_block_id from public.resume_entries where id = p_entry_id)
      and b.user_id = auth.uid();
  if not found then
    -- source_block_id is null (block deleted) or block not owned.
    if (select source_block_id from public.resume_entries where id = p_entry_id) is null then
      raise exception 'no_source_block';
    else
      raise exception 'source_not_found';
    end if;
  end if;

  -- Field-selection must be a subset of the known comparable fields.
  if not (v_apply <@ array['title','subtitle','organization','location','start_date','end_date','education_data','skills_data']) then
    raise exception 'invalid_field_selection';
  end if;

  -- A bullet cannot be both updated and removed.
  if exists (select 1 from unnest(v_update) u where u = any(v_remove)) then
    raise exception 'conflicting_selection';
  end if;

  -- Removals require explicit confirmation.
  if array_length(v_remove, 1) is not null and not p_confirm_removals then
    raise exception 'removal_not_confirmed';
  end if;

  -- Every update target must belong to this entry and still have a live source in the block.
  if array_length(v_update, 1) is not null and exists (
    select 1 from unnest(v_update) uid
    where not exists (
      select 1 from public.resume_entry_bullets eb
      join public.resume_library_bullets lb on lb.id = eb.source_bullet_id
      where eb.id = uid and eb.entry_id = p_entry_id and eb.resume_id = p_resume_id
        and lb.block_id = v_block.id and lb.user_id = auth.uid())
  ) then
    raise exception 'source_bullet_not_found';
  end if;

  -- Every add target must belong to the block and not already be sourced in the entry.
  if array_length(v_add, 1) is not null and exists (
    select 1 from unnest(v_add) aid
    where not exists (
      select 1 from public.resume_library_bullets lb
      where lb.id = aid and lb.block_id = v_block.id and lb.user_id = auth.uid())
    or exists (
      select 1 from public.resume_entry_bullets eb
      where eb.entry_id = p_entry_id and eb.source_bullet_id = aid)
  ) then
    raise exception 'invalid_selection';
  end if;

  -- Every removal target must belong to this entry.
  if array_length(v_remove, 1) is not null and exists (
    select 1 from unnest(v_remove) rid
    where not exists (
      select 1 from public.resume_entry_bullets eb
      where eb.id = rid and eb.entry_id = p_entry_id and eb.resume_id = p_resume_id)
  ) then
    raise exception 'bullet_not_found';
  end if;

  -- Apply selected entry-field changes from authoritative block values.
  update public.resume_entries e set
      title           = case when 'title'          = any(v_apply) then v_block.title          else e.title end,
      subtitle        = case when 'subtitle'       = any(v_apply) then v_block.subtitle       else e.subtitle end,
      organization    = case when 'organization'   = any(v_apply) then v_block.organization   else e.organization end,
      location        = case when 'location'       = any(v_apply) then v_block.location       else e.location end,
      start_date      = case when 'start_date'     = any(v_apply) then v_block.start_date     else e.start_date end,
      end_date        = case when 'end_date'       = any(v_apply) then v_block.end_date       else e.end_date end,
      education_data  = case when 'education_data' = any(v_apply) then v_block.education_data  else e.education_data end,
      skills_data     = case when 'skills_data'    = any(v_apply) then v_block.skills_data     else e.skills_data end,
      source_block_updated_at = v_block.updated_at
    where e.id = p_entry_id;

  -- Reset selected copied bullets to authoritative library content.
  if array_length(v_update, 1) is not null then
    update public.resume_entry_bullets eb set content = lb.content
      from public.resume_library_bullets lb
      where eb.id = any(v_update) and eb.entry_id = p_entry_id and eb.source_bullet_id = lb.id;
  end if;

  -- Append selected new library bullets, preserving library order.
  if array_length(v_add, 1) is not null then
    select coalesce(max(sort_order), 0) into v_sort from public.resume_entry_bullets where entry_id = p_entry_id;
    insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
      select auth.uid(), p_resume_id, p_entry_id, lb.id, lb.content,
             v_sort + row_number() over (order by lb.sort_order)
      from public.resume_library_bullets lb
      where lb.id = any(v_add) and lb.block_id = v_block.id and lb.user_id = auth.uid();
  end if;

  -- Remove selected resume bullets.
  if array_length(v_remove, 1) is not null then
    delete from public.resume_entry_bullets where id = any(v_remove) and entry_id = p_entry_id;
  end if;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;

  return query select v_rev,
    coalesce(array_length(v_apply, 1), 0),
    coalesce(array_length(v_update, 1), 0),
    coalesce(array_length(v_add, 1), 0),
    coalesce(array_length(v_remove, 1), 0);
end;
$$;
revoke execute on function public.apply_library_update(uuid, integer, uuid, text[], uuid[], uuid[], uuid[], boolean) from public;
revoke execute on function public.apply_library_update(uuid, integer, uuid, text[], uuid[], uuid[], uuid[], boolean) from anon;
revoke execute on function public.apply_library_update(uuid, integer, uuid, text[], uuid[], uuid[], uuid[], boolean) from authenticated;
revoke execute on function public.apply_library_update(uuid, integer, uuid, text[], uuid[], uuid[], uuid[], boolean) from service_role;
grant execute on function public.apply_library_update(uuid, integer, uuid, text[], uuid[], uuid[], uuid[], boolean) to authenticated;

-- ─── (4) move_entry_to_position ─────────────────────────────────────────────
-- Combined atomic move + reorder. p_ordered_entry_ids is the COMPLETE final
-- ordering of the target section (including the moved entry). Works within a
-- section and across compatible sections; renumbers both source and target
-- contiguously.
create function move_entry_to_position(
  p_resume_id uuid, p_expected_revision integer, p_entry_id uuid,
  p_target_section_id uuid, p_ordered_entry_ids uuid[])
returns table(revision integer, section_id uuid, ordered_entry_ids uuid[])
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_old_section_id uuid;
  v_old_layout text;
  v_target_layout text;
  v_len integer;
  i integer;
  v_expected_count integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select se.section_id, s.layout_kind into v_old_section_id, v_old_layout
    from public.resume_entries se join public.resume_sections s on s.id = se.section_id
    where se.id = p_entry_id and se.resume_id = p_resume_id and se.user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;

  select layout_kind into v_target_layout from public.resume_sections
    where id = p_target_section_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'section_not_found'; end if;

  if v_old_layout != v_target_layout then raise exception 'layout_kind_mismatch'; end if;

  v_len := coalesce(array_length(p_ordered_entry_ids, 1), 0);

  -- Expected final target-section membership = (current target entries minus the
  -- moved entry, if it's already there) plus the moved entry.
  -- `te` alias: `section_id` also names this function's RETURNS TABLE output
  -- column, so bare references are ambiguous and must be qualified.
  v_expected_count := (
    select count(*) from public.resume_entries te
    where te.section_id = p_target_section_id and te.id != p_entry_id
  ) + 1;

  if v_len != v_expected_count
     or exists (
       select 1 from unnest(p_ordered_entry_ids) as eid
       where eid != p_entry_id
         and not exists (
           select 1 from public.resume_entries e
           where e.id = eid and e.section_id = p_target_section_id and e.resume_id = p_resume_id)
     )
     or not (p_entry_id = any(p_ordered_entry_ids)) then
    raise exception 'invalid_reorder_set';
  end if;

  -- Move the entry into the target section (no-op when already there).
  update public.resume_entries te set section_id = p_target_section_id where te.id = p_entry_id;

  -- Renumber the target section per the provided order.
  for i in 1..v_len loop
    update public.resume_entries te set sort_order = i where te.id = p_ordered_entry_ids[i];
  end loop;

  -- Cross-section move: renumber what remains in the source section contiguously.
  if v_old_section_id != p_target_section_id then
    with ordered as (
      select te.id, row_number() over (order by te.sort_order, te.created_at) as rn
      from public.resume_entries te where te.section_id = v_old_section_id)
    update public.resume_entries te set sort_order = ordered.rn
      from ordered where te.id = ordered.id;
  end if;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_rev, p_target_section_id, p_ordered_entry_ids;
end;
$$;
revoke execute on function public.move_entry_to_position(uuid, integer, uuid, uuid, uuid[]) from public;
revoke execute on function public.move_entry_to_position(uuid, integer, uuid, uuid, uuid[]) from anon;
revoke execute on function public.move_entry_to_position(uuid, integer, uuid, uuid, uuid[]) from authenticated;
revoke execute on function public.move_entry_to_position(uuid, integer, uuid, uuid, uuid[]) from service_role;
grant execute on function public.move_entry_to_position(uuid, integer, uuid, uuid, uuid[]) to authenticated;

-- ─── (5) save_bullet_as_library_bullet ──────────────────────────────────────
-- Creates a new library bullet from the current resume-bullet text and
-- re-links the resume bullet to it. Never overwrites an existing library
-- bullet; never changes the resume bullet text. Bumps the draft revision
-- because the source relationship changed.
create function save_bullet_as_library_bullet(
  p_resume_id uuid, p_expected_revision integer, p_bullet_id uuid, p_block_id uuid)
returns table(library_bullet_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_content text;
  v_new_lib_id uuid;
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select content into v_content from public.resume_entry_bullets
    where id = p_bullet_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'bullet_not_found'; end if;

  if not exists (select 1 from public.resume_library_blocks where id = p_block_id and user_id = auth.uid()) then
    raise exception 'block_not_found';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.resume_library_bullets where block_id = p_block_id;

  insert into public.resume_library_bullets (user_id, block_id, content, sort_order)
    values (auth.uid(), p_block_id, v_content, v_sort)
    returning id into v_new_lib_id;

  update public.resume_entry_bullets set source_bullet_id = v_new_lib_id where id = p_bullet_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_new_lib_id, v_rev;
end;
$$;
revoke execute on function public.save_bullet_as_library_bullet(uuid, integer, uuid, uuid) from public;
revoke execute on function public.save_bullet_as_library_bullet(uuid, integer, uuid, uuid) from anon;
revoke execute on function public.save_bullet_as_library_bullet(uuid, integer, uuid, uuid) from authenticated;
revoke execute on function public.save_bullet_as_library_bullet(uuid, integer, uuid, uuid) from service_role;
grant execute on function public.save_bullet_as_library_bullet(uuid, integer, uuid, uuid) to authenticated;

-- ─── (6) restore_entry ──────────────────────────────────────────────────────
-- Undo of an entry deletion. Recreates the entry (new id) with the captured
-- content and bullets at the captured position. Source references are kept
-- only when still valid/owned/compatible; otherwise nulled. Fails if the
-- destination section no longer exists (restore the section first).
create function restore_entry(
  p_resume_id uuid, p_expected_revision integer, p_section_id uuid, p_position integer,
  p_title text, p_subtitle text, p_organization text, p_location text,
  p_start_date date, p_end_date date, p_education_data jsonb, p_skills_data jsonb,
  p_source_block_id uuid, p_bullets jsonb)
returns table(entry_id uuid, bullet_ids uuid[], revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_layout text;
  v_pos integer;
  v_count integer;
  v_source_block_id uuid := null;
  v_source_updated_at timestamptz := null;
  v_new_entry_id uuid;
  v_bullet_ids uuid[] := array[]::uuid[];
  v_elem jsonb;
  v_idx integer := 0;
  v_src uuid;
  v_new_bullet_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select layout_kind into v_layout from public.resume_sections
    where id = p_section_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'section_not_found'; end if;

  -- Content must be compatible with the destination section layout.
  if v_layout = 'entry' and (p_education_data is not null or p_skills_data is not null) then
    raise exception 'layout_kind_mismatch';
  elsif v_layout = 'education' and p_skills_data is not null then
    raise exception 'layout_kind_mismatch';
  elsif v_layout = 'skills' and p_education_data is not null then
    raise exception 'layout_kind_mismatch';
  end if;

  if p_bullets is null or jsonb_typeof(p_bullets) != 'array' then
    raise exception 'invalid_snapshot';
  end if;

  -- Keep the source block link only if the block still exists, is owned, and
  -- shares the destination section's layout.
  if p_source_block_id is not null then
    select b.updated_at into v_source_updated_at from public.resume_library_blocks b
      where b.id = p_source_block_id and b.user_id = auth.uid() and b.layout_kind = v_layout;
    if found then v_source_block_id := p_source_block_id; else v_source_updated_at := null; end if;
  end if;

  -- Clamp the position into [1, count+1] and shift siblings up to make room.
  select count(*) into v_count from public.resume_entries where section_id = p_section_id;
  v_pos := greatest(1, least(coalesce(p_position, v_count + 1), v_count + 1));
  update public.resume_entries set sort_order = sort_order + 1
    where section_id = p_section_id and sort_order >= v_pos;

  insert into public.resume_entries (user_id, resume_id, section_id, source_block_id, source_block_updated_at,
      title, subtitle, organization, location, start_date, end_date, education_data, skills_data, sort_order)
    values (auth.uid(), p_resume_id, p_section_id, v_source_block_id, v_source_updated_at,
      p_title, p_subtitle, p_organization, p_location, p_start_date, p_end_date,
      p_education_data, p_skills_data, v_pos)
    returning id into v_new_entry_id;

  -- Recreate bullets in captured order. Source link kept only when still valid.
  for v_elem in select * from jsonb_array_elements(p_bullets) loop
    v_idx := v_idx + 1;
    v_src := null;
    if v_source_block_id is not null and (v_elem->>'source_bullet_id') is not null then
      if exists (select 1 from public.resume_library_bullets lb
                 where lb.id = (v_elem->>'source_bullet_id')::uuid
                   and lb.block_id = v_source_block_id and lb.user_id = auth.uid()) then
        v_src := (v_elem->>'source_bullet_id')::uuid;
      end if;
    end if;
    insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
      values (auth.uid(), p_resume_id, v_new_entry_id, v_src, coalesce(v_elem->>'content', ''), v_idx)
      returning id into v_new_bullet_id;
    v_bullet_ids := v_bullet_ids || v_new_bullet_id;
  end loop;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_new_entry_id, v_bullet_ids, v_rev;
end;
$$;
revoke execute on function public.restore_entry(uuid, integer, uuid, integer, text, text, text, text, date, date, jsonb, jsonb, uuid, jsonb) from public;
revoke execute on function public.restore_entry(uuid, integer, uuid, integer, text, text, text, text, date, date, jsonb, jsonb, uuid, jsonb) from anon;
revoke execute on function public.restore_entry(uuid, integer, uuid, integer, text, text, text, text, date, date, jsonb, jsonb, uuid, jsonb) from authenticated;
revoke execute on function public.restore_entry(uuid, integer, uuid, integer, text, text, text, text, date, date, jsonb, jsonb, uuid, jsonb) from service_role;
grant execute on function public.restore_entry(uuid, integer, uuid, integer, text, text, text, text, date, date, jsonb, jsonb, uuid, jsonb) to authenticated;

-- ─── (7) restore_bullet ─────────────────────────────────────────────────────
create function restore_bullet(
  p_resume_id uuid, p_expected_revision integer, p_entry_id uuid, p_position integer,
  p_content text, p_source_bullet_id uuid)
returns table(bullet_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_source_block_id uuid;
  v_src uuid := null;
  v_pos integer;
  v_count integer;
  v_new_bullet_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  select source_block_id into v_source_block_id from public.resume_entries
    where id = p_entry_id and resume_id = p_resume_id and user_id = auth.uid();
  if not found then raise exception 'entry_not_found'; end if;

  -- Keep the bullet source link only when the library bullet still exists,
  -- is owned, and belongs to the entry's current source block.
  if p_source_bullet_id is not null and v_source_block_id is not null then
    if exists (select 1 from public.resume_library_bullets lb
               where lb.id = p_source_bullet_id and lb.block_id = v_source_block_id and lb.user_id = auth.uid()) then
      v_src := p_source_bullet_id;
    end if;
  end if;

  select count(*) into v_count from public.resume_entry_bullets where entry_id = p_entry_id;
  v_pos := greatest(1, least(coalesce(p_position, v_count + 1), v_count + 1));
  update public.resume_entry_bullets set sort_order = sort_order + 1
    where entry_id = p_entry_id and sort_order >= v_pos;

  insert into public.resume_entry_bullets (user_id, resume_id, entry_id, source_bullet_id, content, sort_order)
    values (auth.uid(), p_resume_id, p_entry_id, v_src, p_content, v_pos)
    returning id into v_new_bullet_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_new_bullet_id, v_rev;
end;
$$;
revoke execute on function public.restore_bullet(uuid, integer, uuid, integer, text, uuid) from public;
revoke execute on function public.restore_bullet(uuid, integer, uuid, integer, text, uuid) from anon;
revoke execute on function public.restore_bullet(uuid, integer, uuid, integer, text, uuid) from authenticated;
revoke execute on function public.restore_bullet(uuid, integer, uuid, integer, text, uuid) from service_role;
grant execute on function public.restore_bullet(uuid, integer, uuid, integer, text, uuid) to authenticated;

-- ─── (8) restore_section ────────────────────────────────────────────────────
-- Undo of a section deletion. Step 1 only deletes empty sections, so this
-- restores an empty section (new id) with the captured title, layout, and
-- position.
create function restore_section(
  p_resume_id uuid, p_expected_revision integer, p_position integer,
  p_title text, p_layout_kind text)
returns table(section_id uuid, revision integer)
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_rev integer;
  v_pos integer;
  v_count integer;
  v_new_section_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select r.revision into v_rev from public.resumes r where r.id = p_resume_id and r.user_id = auth.uid() for update;
  if not found then raise exception 'resume_not_found'; end if;
  if v_rev != p_expected_revision then raise exception 'revision_conflict'; end if;

  if p_layout_kind not in ('entry', 'education', 'skills') then
    raise exception 'layout_kind_mismatch';
  end if;

  select count(*) into v_count from public.resume_sections where resume_id = p_resume_id;
  v_pos := greatest(1, least(coalesce(p_position, v_count + 1), v_count + 1));
  update public.resume_sections set sort_order = sort_order + 1
    where resume_id = p_resume_id and sort_order >= v_pos;

  insert into public.resume_sections (user_id, resume_id, title, layout_kind, sort_order)
    values (auth.uid(), p_resume_id, p_title, p_layout_kind, v_pos)
    returning id into v_new_section_id;

  update public.resumes as r set revision = r.revision + 1 where r.id = p_resume_id;
  select r.revision into v_rev from public.resumes r where r.id = p_resume_id;
  return query select v_new_section_id, v_rev;
end;
$$;
revoke execute on function public.restore_section(uuid, integer, integer, text, text) from public;
revoke execute on function public.restore_section(uuid, integer, integer, text, text) from anon;
revoke execute on function public.restore_section(uuid, integer, integer, text, text) from authenticated;
revoke execute on function public.restore_section(uuid, integer, integer, text, text) from service_role;
grant execute on function public.restore_section(uuid, integer, integer, text, text) to authenticated;
