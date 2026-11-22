-- =====================================================================
-- 040 — dispatch and on-site work
-- Adds the job's stops in order, what the job needs, the queue of workers it
-- is offered to, and every offer and its outcome. Adds the record of what
-- happened on site: each "online / arrived / left / complete" slide, photos,
-- customer requests and problems, and the live location of a worker while
-- they are working. Also adds the crew-seat columns V2 needs. Safe to re-run.
-- =====================================================================

-- ---------- job_stops ----------------------------------------------
create table if not exists job_stops (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs(id) on delete cascade,
  position   integer not null,
  address    text not null,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now(),
  unique (job_id, position)
);
comment on table job_stops is 'The addresses on a job, in order. This table is the source of truth; jobs.addresses is a copy kept in step by trigger so the browser app still reads it.';

-- Backfill from the V1 array before the trigger takes over. Existing jobs
-- keep their addresses exactly, in the same order.
insert into job_stops (job_id, position, address)
select j.id, a.ord - 1, a.address
  from jobs j
 cross join lateral unnest(j.addresses) with ordinality as a(address, ord)
 where a.address is not null and a.address <> ''
on conflict (job_id, position) do nothing;

create or replace function sync_job_addresses() returns trigger
language plpgsql set search_path = public as $$
declare
  jid uuid := coalesce(new.job_id, old.job_id);
begin
  update jobs
     set addresses = coalesce(
           (select array_agg(address order by position) from job_stops where job_id = jid),
           '{}'::text[])
   where id = jid;
  return coalesce(new, old);
end $$;
comment on function sync_job_addresses() is 'Rebuilds jobs.addresses from job_stops whenever a stop changes.';

drop trigger if exists job_stops_sync_addresses on job_stops;
create trigger job_stops_sync_addresses after insert or update or delete on job_stops
  for each row execute function sync_job_addresses();

alter table job_stops enable row level security;
drop policy if exists job_stops_staff_all on job_stops;
create policy job_stops_staff_all on job_stops
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- job_needs -------------------------------------------------
create table if not exists job_needs (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  kind         text not null check (kind in ('equipment','vehicle','skill')),
  list_item_id uuid references list_items(id) on delete set null,
  item_name    text,
  quantity     integer not null default 1 check (quantity >= 1),
  created_at   timestamptz not null default now()
);
comment on table job_needs is 'What a job needs from its crew: equipment, a vehicle type, or a skill. Used to match workers to the job.';
alter table job_needs enable row level security;
drop policy if exists job_needs_staff_all on job_needs;
create policy job_needs_staff_all on job_needs
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- job_pool and job_offers ----------------------------------
create table if not exists job_pool (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs(id) on delete cascade,
  entity_id  uuid not null references entities(id) on delete cascade,
  position   integer not null,
  created_at timestamptz not null default now(),
  unique (job_id, entity_id)
);
comment on table job_pool is 'The workers a job may be offered to, in the order they will be offered it.';
alter table job_pool enable row level security;
drop policy if exists job_pool_staff_all on job_pool;
create policy job_pool_staff_all on job_pool
  for all to authenticated using (is_staff()) with check (is_staff());

create table if not exists job_offers (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  entity_id    uuid not null references entities(id) on delete cascade,
  position     integer not null,
  offered_at   timestamptz,
  expires_at   timestamptz,
  outcome      text not null default 'waiting'
               check (outcome in ('waiting','offered','taken','timed_out','skipped')),
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);
comment on table job_offers is 'Every offer of a job to a worker, and what happened: waiting, offered, taken, timed out or skipped.';
comment on column job_offers.expires_at is 'When the offer passes to the next worker if unanswered (offered_at + settings.dispatch_wait_seconds).';
create index if not exists job_offers_job_idx on job_offers (job_id);
create index if not exists job_offers_entity_idx on job_offers (entity_id, outcome);
alter table job_offers enable row level security;
drop policy if exists job_offers_staff_all on job_offers;
create policy job_offers_staff_all on job_offers
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists job_offers_own_read on job_offers;
create policy job_offers_own_read on job_offers
  for select to authenticated using (entity_id = my_entity_id());

-- ---------- job_workers: crew-seat columns ---------------------------
-- Existing is_leader is the point of contact; no new column for that.
alter table job_workers add column if not exists assigned_via text
  check (assigned_via is null or assigned_via in ('offer','queue','manual','vendor'));
comment on column job_workers.assigned_via is 'How the seat was filled: taken from an offer, from the queue, set by hand, or a vendor.';
alter table job_workers add column if not exists assigned_at timestamptz;
alter table job_workers add column if not exists released_at timestamptz;
comment on column job_workers.released_at is 'Set when the worker gives the seat back ("I can''t make it"). A released seat is not counted against the crew.';
alter table job_workers add column if not exists be_online_by timestamptz;
comment on column job_workers.be_online_by is 'The time the worker must press "online" by. Set from the arrival time.';
alter table job_workers add column if not exists hours_corrected_by uuid references profiles(id) on delete set null;
alter table job_workers add column if not exists hours_corrected_at timestamptz;
comment on column job_workers.hours_corrected_at is 'When the dispatcher last changed this worker''s hours away from the slide-derived figures.';

-- ---------- job_slides ------------------------------------------------
create table if not exists job_slides (
  id            uuid primary key default gen_random_uuid(),
  job_worker_id uuid not null references job_workers(id) on delete cascade,
  kind          text not null check (kind in ('online','arrive','leave','complete')),
  stop_position integer,
  -- The time on the worker's phone when they pressed. Kept even if the
  -- phone was offline when it happened.
  occurred_at   timestamptz not null,
  recorded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
comment on table job_slides is 'Every "online / arrive / leave / complete" press a crew member makes. Hours are worked out from these.';
comment on column job_slides.occurred_at is 'When it happened on the phone. May be earlier than recorded_at when it was sent after going back online.';
create index if not exists job_slides_worker_idx on job_slides (job_worker_id, occurred_at);
alter table job_slides enable row level security;
drop policy if exists job_slides_staff_all on job_slides;
create policy job_slides_staff_all on job_slides
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists job_slides_own on job_slides;
create policy job_slides_own on job_slides
  for all to authenticated
  using (job_worker_id in (select my_job_worker_ids()))
  with check (job_worker_id in (select my_job_worker_ids()));

-- ---------- job_photos ------------------------------------------------
create table if not exists job_photos (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  job_worker_id uuid references job_workers(id) on delete set null,
  stop_position integer,
  kind          text not null check (kind in ('before','stop','after','damage','other')),
  storage_path  text not null,
  taken_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
comment on table job_photos is 'Photos taken on a job. The files sit in the job-photos bucket.';
create index if not exists job_photos_job_idx on job_photos (job_id);
alter table job_photos enable row level security;
drop policy if exists job_photos_staff_all on job_photos;
create policy job_photos_staff_all on job_photos
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists job_photos_own on job_photos;
create policy job_photos_own on job_photos
  for all to authenticated
  using (job_worker_id in (select my_job_worker_ids()))
  with check (job_worker_id in (select my_job_worker_ids()));

-- ---------- job_events ------------------------------------------------
create table if not exists job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  kind        text not null check (kind in (
                'change_request','cancel_request','problem','running_late',
                'cant_get_in','job_bigger','damage','give_back')),
  body        text,
  raised_by   uuid references profiles(id) on delete set null,
  raised_at   timestamptz not null default now(),
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz
);
comment on table job_events is 'Customer requests and "Something''s up" reports on a job, until someone resolves them.';
create index if not exists job_events_job_idx on job_events (job_id, resolved_at);
alter table job_events enable row level security;
drop policy if exists job_events_staff_all on job_events;
create policy job_events_staff_all on job_events
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- worker_locations -----------------------------------------
create table if not exists worker_locations (
  job_worker_id uuid primary key references job_workers(id) on delete cascade,
  lat           double precision not null,
  lng           double precision not null,
  updated_at    timestamptz not null default now()
);
comment on table worker_locations is 'Live position of a worker while they are working on a job. Written only between online and complete; the row is deleted on complete.';
alter table worker_locations enable row level security;
drop policy if exists worker_locations_staff_all on worker_locations;
create policy worker_locations_staff_all on worker_locations
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists worker_locations_own on worker_locations;
create policy worker_locations_own on worker_locations
  for all to authenticated
  using (job_worker_id in (select my_job_worker_ids()))
  with check (job_worker_id in (select my_job_worker_ids()));
