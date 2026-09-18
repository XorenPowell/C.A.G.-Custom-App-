-- =====================================================================
-- 015 — Arrival windows
--
-- Replaces a job's single arrival date/time with up to three optional
-- arrival windows (a date plus an optional start-end time range each),
-- individually exposed as {{arrival_window_1}}, {{arrival_window_2}} and
-- {{arrival_window_3}}. Not all three need to be filled in.
--
-- jobs.arrival_date/arrival_time are KEPT, but repurposed: a trigger now
-- keeps them mirroring the lowest-sort_order populated window, so every
-- existing "primary arrival date" consumer (Jobs list default sort/column,
-- Home's Booked Today, the dashboard's activity-date fallback, Google
-- Calendar sync) keeps working unchanged, reading window 1 (or the
-- earliest filled window, if window 1 is skipped).
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists job_arrival_windows (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs(id) on delete cascade,
  sort_order integer not null,
  date       date not null,
  start_time time,
  end_time   time
);
create index if not exists job_arrival_windows_job_idx on job_arrival_windows (job_id);
create index if not exists job_arrival_windows_date_idx on job_arrival_windows (date);

-- One-time backfill: each job's current single arrival_date/arrival_time
-- becomes its arrival window 1.
insert into job_arrival_windows (job_id, sort_order, date, start_time, end_time)
select id, 0, arrival_date, arrival_time, null
from jobs
where arrival_date is not null
  and not exists (select 1 from job_arrival_windows w where w.job_id = jobs.id);

-- Keeps jobs.arrival_date/arrival_time mirroring the lowest-sort_order
-- populated window (or null if none), so existing sort/query/calendar
-- code needs no changes.
create or replace function sync_job_primary_arrival() returns trigger language plpgsql as $$
declare
  jid uuid := coalesce(new.job_id, old.job_id);
  primary_row record;
begin
  select date, start_time into primary_row
  from job_arrival_windows
  where job_id = jid
  order by sort_order
  limit 1;

  update jobs
     set arrival_date = primary_row.date,
         arrival_time = primary_row.start_time
   where id = jid;

  return coalesce(new, old);
end $$;

drop trigger if exists job_arrival_windows_sync on job_arrival_windows;
create trigger job_arrival_windows_sync
  after insert or update or delete on job_arrival_windows
  for each row execute function sync_job_primary_arrival();

alter table job_arrival_windows enable row level security;
drop policy if exists job_arrival_windows_authenticated_all on job_arrival_windows;
create policy job_arrival_windows_authenticated_all on job_arrival_windows
  for all to authenticated using (true) with check (true);
