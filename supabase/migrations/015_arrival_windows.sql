-- =====================================================================
-- 015 — Arrival windows + confirmed arrival time
--
-- Before a job is Booked, the dispatcher may offer up to three optional
-- arrival windows (a date plus an optional start-end time range each),
-- individually exposed as {{arrival_window_1}}, {{arrival_window_2}} and
-- {{arrival_window_3}}. Not all three need to be filled in.
--
-- Once a job is Booked, a single confirmed arrival date/time takes over
-- as the job's actual schedule — exposed as {{arrival_date}}/
-- {{arrival_time}}. The windows are left as-is (a record of what was
-- offered), not deleted.
--
-- jobs.arrival_date/arrival_time are KEPT, but repurposed: a trigger now
-- keeps them mirroring the confirmed time (once Booked and set) or
-- otherwise the lowest-sort_order populated window, so every existing
-- "primary arrival date" consumer (Jobs list default sort/column, Home's
-- Booked Today, the dashboard's activity-date fallback, Google Calendar
-- sync) keeps working unchanged.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table jobs add column if not exists confirmed_arrival_date date;
alter table jobs add column if not exists confirmed_arrival_time time;

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

-- Keeps jobs.arrival_date/arrival_time mirroring the confirmed arrival
-- time (once status = Booked and it's set), else the lowest-sort_order
-- populated window. Shared by a trigger on job_arrival_windows (window
-- edits) and one on jobs itself (status/confirmed-time edits).
create or replace function sync_job_primary_arrival() returns trigger language plpgsql as $$
declare
  jid uuid;
  job_status text;
  confirmed_date date;
  confirmed_time time;
  primary_date date;
  primary_time time;
begin
  if tg_table_name = 'jobs' then
    jid := new.id;
    job_status := new.status;
    confirmed_date := new.confirmed_arrival_date;
    confirmed_time := new.confirmed_arrival_time;
  else
    jid := coalesce(new.job_id, old.job_id);
    select status, confirmed_arrival_date, confirmed_arrival_time
      into job_status, confirmed_date, confirmed_time
      from jobs where id = jid;
  end if;

  if job_status = 'Booked' and confirmed_date is not null then
    primary_date := confirmed_date;
    primary_time := confirmed_time;
  else
    select date, start_time into primary_date, primary_time
    from job_arrival_windows
    where job_id = jid
    order by sort_order
    limit 1;
  end if;

  update jobs
     set arrival_date = primary_date,
         arrival_time = primary_time
   where id = jid
     and (arrival_date is distinct from primary_date or arrival_time is distinct from primary_time);

  return coalesce(new, old);
end $$;

drop trigger if exists job_arrival_windows_sync on job_arrival_windows;
create trigger job_arrival_windows_sync
  after insert or update or delete on job_arrival_windows
  for each row execute function sync_job_primary_arrival();

drop trigger if exists jobs_primary_arrival_sync on jobs;
create trigger jobs_primary_arrival_sync
  after insert or update of status, confirmed_arrival_date, confirmed_arrival_time on jobs
  for each row execute function sync_job_primary_arrival();

alter table job_arrival_windows enable row level security;
drop policy if exists job_arrival_windows_authenticated_all on job_arrival_windows;
create policy job_arrival_windows_authenticated_all on job_arrival_windows
  for all to authenticated using (true) with check (true);
