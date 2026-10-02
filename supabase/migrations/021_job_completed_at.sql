-- =====================================================================
-- 021 — Track actual job-completion moment for accurate commission dating
--
-- The dashboard's commission figure was dated by invoice/arrival/created
-- date — none of which reflect when the job was ACTUALLY completed. You
-- don't earn the commission until the job is done. Adds completed_at,
-- stamped by trigger the moment a job's status transitions into
-- 'Completed' (and cleared if it moves back out — it isn't completed
-- anymore). Commission alone now dates by this; volume and revenue are
-- unchanged (back to invoice/arrival/created date, as before).
--
-- Backfill: jobs already Completed before this migration never had their
-- true completion moment tracked, so it's approximated from the best
-- available signal (arrival date, then invoice date, then last update,
-- then creation) — a one-time estimate. Every completion from here
-- forward is exact.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table jobs add column if not exists completed_at timestamptz;
create index if not exists jobs_completed_at_idx on jobs (completed_at);

create or replace function stamp_job_completed_at() returns trigger language plpgsql as $$
begin
  if new.status = 'Completed' and (tg_op = 'INSERT' or old.status is distinct from 'Completed') then
    new.completed_at := now();
  elsif new.status <> 'Completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists jobs_stamp_completed_at on jobs;
create trigger jobs_stamp_completed_at before insert or update on jobs
  for each row execute function stamp_job_completed_at();

update jobs
set completed_at = coalesce(arrival_date::timestamptz, date_of_invoice::timestamptz, updated_at, created_at)
where status = 'Completed' and completed_at is null;
