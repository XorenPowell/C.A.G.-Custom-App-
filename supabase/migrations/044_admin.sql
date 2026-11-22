-- =====================================================================
-- 044 — admin: module grants, reports, audit trail and status history
-- Lets the local admin give extra modules to a whole role or to one account,
-- stores the reports they build, and records every change to key fields and
-- every job status change, with who made it and when. Safe to re-run.
-- =====================================================================

-- ---------- module_grants ---------------------------------------------
create table if not exists module_grants (
  id          uuid primary key default gen_random_uuid(),
  module_key  text not null,
  role        text check (role is null or role in ('customer','worker','dispatcher','local_admin')),
  profile_id  uuid references profiles(id) on delete cascade,
  granted_by  uuid references profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  -- Exactly one of role or profile_id is set: a grant is either for a role or for one account.
  check ((role is null) <> (profile_id is null))
);
comment on table module_grants is 'Extra modules granted to a whole role, or to one account. Read by has_module().';
alter table module_grants enable row level security;
drop policy if exists module_grants_staff_read on module_grants;
create policy module_grants_staff_read on module_grants
  for select to authenticated using (is_staff());
drop policy if exists module_grants_admin_write on module_grants;
create policy module_grants_admin_write on module_grants
  for all to authenticated using (is_local_admin()) with check (is_local_admin());

-- Local admins always have every module. Everyone else has a module when a
-- grant names their role or their account.
create or replace function has_module(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_local_admin() or exists (
    select 1 from module_grants g
     where g.module_key = p_key
       and (g.role = my_role() or g.profile_id = auth.uid())
  );
$$;
comment on function has_module(text) is 'True when the signed-in account may use the named module.';

-- ---------- report_definitions ----------------------------------------
create table if not exists report_definitions (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  -- Ordered blocks: each is a measure, a chart or a table, with filters.
  blocks              jsonb not null default '[]'::jsonb,
  visible_roles       text[] not null default '{}',
  visible_profile_ids uuid[] not null default '{}',
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table report_definitions is 'Reports the local admin builds, and which roles or accounts may see each one.';
drop trigger if exists report_definitions_updated_at on report_definitions;
create trigger report_definitions_updated_at before update on report_definitions
  for each row execute function set_updated_at();
alter table report_definitions enable row level security;
drop policy if exists report_definitions_read on report_definitions;
create policy report_definitions_read on report_definitions
  for select to authenticated
  using (is_local_admin() or my_role() = any(visible_roles) or auth.uid() = any(visible_profile_ids));
drop policy if exists report_definitions_admin_write on report_definitions;
create policy report_definitions_admin_write on report_definitions
  for all to authenticated using (is_local_admin()) with check (is_local_admin());

-- ---------- audit_log --------------------------------------------------
create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  table_name   text not null,
  -- Text, not uuid: settings uses a boolean id.
  row_id       text,
  column_name  text not null,
  old_value    text,
  new_value    text,
  changed_by   uuid references profiles(id) on delete set null,
  changed_at   timestamptz not null default now()
);
comment on table audit_log is 'Every change to a key field: which table and row, which column, the old and new value, who changed it and when.';
create index if not exists audit_log_row_idx on audit_log (table_name, row_id, changed_at);
alter table audit_log enable row level security;
drop policy if exists audit_log_staff_read on audit_log;
create policy audit_log_staff_read on audit_log
  for select to authenticated using (is_staff());
-- No insert/update/delete policy: only the trigger below writes here.

create or replace function write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_j jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_j jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  k text;
  rid text := coalesce(new_j->>'id', old_j->>'id');
begin
  for k in select jsonb_object_keys(old_j || new_j) loop
    -- updated_at changes on every save, so it is noise here.
    continue when k = 'updated_at';
    if old_j->k is distinct from new_j->k then
      insert into audit_log (table_name, row_id, column_name, old_value, new_value, changed_by)
      values (tg_table_name, rid, k, old_j->>k, new_j->>k, auth.uid());
    end if;
  end loop;
  return coalesce(new, old);
end $$;
comment on function write_audit_log() is 'Writes one audit_log row per changed column on the key tables.';

do $$
declare t text;
begin
  foreach t in array array['jobs','job_workers','entity_rates','payouts','customer_payments','settings'] loop
    execute format('drop trigger if exists %I on %I', t || '_audit', t);
    execute format(
      'create trigger %I after update on %I for each row execute function write_audit_log()',
      t || '_audit', t);
  end loop;
end $$;

-- ---------- job_status_events -----------------------------------------
create table if not exists job_status_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references profiles(id) on delete set null,
  changed_at  timestamptz not null default now()
);
comment on table job_status_events is 'Every change of a job''s status, with the time and who made it. The first row for a job is its creation.';
create index if not exists job_status_events_job_idx on job_status_events (job_id, changed_at);
alter table job_status_events enable row level security;
drop policy if exists job_status_events_staff_read on job_status_events;
create policy job_status_events_staff_read on job_status_events
  for select to authenticated using (is_staff());

create or replace function record_job_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into job_status_events (job_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into job_status_events (job_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists jobs_record_status on jobs;
create trigger jobs_record_status after insert or update of status on jobs
  for each row execute function record_job_status();

-- Backfill: each existing job starts with one row for its current status, so
-- history reads correctly from today onward.
insert into job_status_events (job_id, from_status, to_status, changed_at)
select j.id, null, j.status, j.created_at
  from jobs j
 where not exists (select 1 from job_status_events e where e.job_id = j.id);
