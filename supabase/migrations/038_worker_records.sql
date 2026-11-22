-- =====================================================================
-- 038 — worker records
-- Links an entity (the roster record) to its worker's login and adds the
-- worker's profile details, paperwork with expiry and approval, the times
-- they cannot work, their own message templates, and a rating that can be
-- explained event by event. Safe to re-run.
-- =====================================================================

-- ---------- entities: login link and profile -------------------------
alter table entities add column if not exists profile_id uuid unique references profiles(id) on delete set null;
comment on column entities.profile_id is 'The worker''s login. Null for roster-only records that have no account.';
alter table entities add column if not exists entity_kind text
  check (entity_kind is null or entity_kind in ('individual','crew','vendor'));
comment on column entities.entity_kind is 'individual, crew or vendor. Null means derive from roster_size as the browser app does.';
alter table entities add column if not exists photo_path text;
comment on column entities.photo_path is 'Storage path of the profile photo in the entity-photos bucket.';
alter table entities add column if not exists home_address text;
comment on column entities.home_address is 'Used to estimate travel time to a job.';
alter table entities add column if not exists home_lat double precision;
alter table entities add column if not exists home_lng double precision;
alter table entities add column if not exists uses_public_transport boolean not null default false;
comment on column entities.uses_public_transport is 'When true, travel time is doubled in estimates.';
alter table entities add column if not exists payout_method text;
comment on column entities.payout_method is 'How pay is sent, e.g. Cash App or Zelle.';
alter table entities add column if not exists payout_handle text;
comment on column entities.payout_handle is 'The account handle for payout_method, e.g. $handle. Visible to the local admin only.';

-- Returns the entity the signed-in worker owns, or null.
create or replace function my_entity_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from entities where profile_id = auth.uid();
$$;
comment on function my_entity_id() is 'The entity belonging to the signed-in worker account, or null.';

-- The crew seats (job_workers rows) that belong to the signed-in worker. Workers
-- cannot read job_workers directly, so policies that need "my seats" call this
-- instead of a subquery: the function runs with owner rights.
create or replace function my_job_worker_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from job_workers where entity_id = my_entity_id();
$$;
comment on function my_job_worker_ids() is 'Ids of the crew seats held by the signed-in worker. Used by row-level security policies.';

-- The jobs the signed-in worker is crewing. Same reason as my_job_worker_ids().
create or replace function my_job_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select job_id from job_workers where entity_id = my_entity_id();
$$;
comment on function my_job_ids() is 'Ids of the jobs the signed-in worker is crewing. Used by storage and row-level security policies.';

-- ---------- entity_equipment: category --------------------------------
alter table entity_equipment add column if not exists category text;
comment on column entity_equipment.category is 'Equipment category, copied from equipment_presets when chosen.';

-- ---------- entity_documents ------------------------------------------
create table if not exists entity_documents (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete cascade,
  doc_type     text not null check (doc_type in (
                 'w9','ic_agreement','photo_id','background_check','drivers_license',
                 'vehicle_insurance','liability_insurance','equipment_photo','verification_photo')),
  storage_path text,
  expires_on   date,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  -- Shown to the worker when a document is rejected.
  reason       text,
  uploaded_by  uuid references profiles(id) on delete set null,
  uploaded_at  timestamptz not null default now(),
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz
);
comment on table entity_documents is 'A worker''s paperwork. Each file has an approval state and an optional expiry. No reminders are sent; expired and expiring-soon are read from expires_on.';
comment on column entity_documents.expires_on is 'Null for documents that do not expire.';
alter table entity_documents enable row level security;
drop policy if exists entity_documents_staff_all on entity_documents;
create policy entity_documents_staff_all on entity_documents
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists entity_documents_own on entity_documents;
create policy entity_documents_own on entity_documents
  for all to authenticated
  using (entity_id = my_entity_id())
  with check (entity_id = my_entity_id() and status = 'pending');
-- Workers can upload and read their own files, but only staff can approve,
-- reject or change status (the with check requires status = 'pending').

-- ---------- entity_unavailability ------------------------------------
create table if not exists entity_unavailability (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  on_date     date,
  end_date    date,
  weekday     smallint check (weekday is null or weekday between 0 and 6),
  start_time  time,
  end_time    time,
  label       text,
  created_at  timestamptz not null default now(),
  check (on_date is not null or weekday is not null)
);
comment on table entity_unavailability is 'Times a worker cannot work. Anything not listed here counts as available. Note: entity_availability (V1) records the opposite, times they can work.';
comment on column entity_unavailability.weekday is 'Repeats every week on this day (0 = Sunday). Use on_date for a one-off.';
comment on column entity_unavailability.start_time is 'Null start and end times mean the whole day.';
alter table entity_unavailability enable row level security;
drop policy if exists entity_unavailability_staff_all on entity_unavailability;
create policy entity_unavailability_staff_all on entity_unavailability
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists entity_unavailability_own on entity_unavailability;
create policy entity_unavailability_own on entity_unavailability
  for all to authenticated
  using (entity_id = my_entity_id())
  with check (entity_id = my_entity_id());

-- ---------- worker_templates ------------------------------------------
create table if not exists worker_templates (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  kind        text not null check (kind in ('cant_make_it','running_late','cant_get_in','job_bigger','damage')),
  body        text not null,
  updated_at  timestamptz not null default now(),
  unique (entity_id, kind)
);
comment on table worker_templates is 'A worker''s own "Something''s up" message templates. Kept apart from staff message_templates.';
comment on column worker_templates.body is 'Text with placeholders {dispatcher} {me} {job} {when} {minutes}, filled in by the app when sent.';
drop trigger if exists worker_templates_updated_at on worker_templates;
create trigger worker_templates_updated_at before update on worker_templates
  for each row execute function set_updated_at();
alter table worker_templates enable row level security;
drop policy if exists worker_templates_staff_read on worker_templates;
create policy worker_templates_staff_read on worker_templates
  for select to authenticated using (is_staff());
drop policy if exists worker_templates_own on worker_templates;
create policy worker_templates_own on worker_templates
  for all to authenticated
  using (entity_id = my_entity_id())
  with check (entity_id = my_entity_id());

-- ---------- rating_rules and rating_events ---------------------------
create table if not exists rating_rules (
  id         uuid primary key default gen_random_uuid(),
  event_key  text not null unique,
  label      text not null,
  delta      numeric(4,2) not null,
  active     boolean not null default true
);
comment on table rating_rules is 'The events that move a worker''s rating, and by how much. Editable by the local admin.';
alter table rating_rules enable row level security;
drop policy if exists rating_rules_staff_read on rating_rules;
create policy rating_rules_staff_read on rating_rules
  for select to authenticated using (is_staff());
drop policy if exists rating_rules_admin_write on rating_rules;
create policy rating_rules_admin_write on rating_rules
  for all to authenticated using (is_local_admin()) with check (is_local_admin());

create table if not exists rating_events (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  rule_id     uuid references rating_rules(id) on delete set null,
  delta       numeric(4,2) not null,
  job_id      uuid references jobs(id) on delete set null,
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on table rating_events is 'Every change to a worker''s rating, so the score can always be explained. The score itself is a view (045).';
comment on column rating_events.delta is 'Copied from the rule at the time, so later rule edits do not rewrite history.';
alter table rating_events enable row level security;
drop policy if exists rating_events_staff_all on rating_events;
create policy rating_events_staff_all on rating_events
  for all to authenticated using (is_staff()) with check (is_staff());
