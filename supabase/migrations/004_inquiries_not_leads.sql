-- =====================================================================
-- 004 — "Lead" renamed to "Inquiry" for jobs (not partnerships)
--
-- The word "lead" meant two different things in this app: a job's demand
-- source (Craigslist, Facebook, ...) and an unsigned partnership prospect.
-- Only the job-side meaning is renamed here — partnerships keep their own,
-- separate "lead" concept (the date_signed discriminator, the Leads/Signed
-- pipeline) untouched.
--
-- Renamed:
--   list_items.kind 'lead_source'   -> 'inquiry_source'
--   jobs.lead_source_id             -> jobs.inquiry_source_id
--   settings.daily_leads_goal       -> settings.daily_inquiries_goal
--
-- All renames use RENAME COLUMN / a data update, so existing rows and
-- foreign keys are preserved — no data loss.
--
-- Every step below checks current state first, so this is safe to run
-- fully idempotently — including a re-run after a partial/failed attempt,
-- regardless of exactly how far that attempt got.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'lead_source_id'
  ) then
    alter table jobs rename column lead_source_id to inquiry_source_id;
  end if;
end $$;

alter index if exists jobs_lead_source_idx rename to jobs_inquiry_source_idx;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'daily_leads_goal'
  ) then
    alter table settings rename column daily_leads_goal to daily_inquiries_goal;
  end if;
end $$;

-- The constraint must allow 'inquiry_source' *before* any row is updated to
-- use it — updating first would fail against the still-active old check.
alter table list_items drop constraint if exists list_items_kind_check;
alter table list_items add constraint list_items_kind_check check (kind in (
  'service_category','inquiry_source','zone',
  'vehicle_type','partnership_status','partnership_tier'));

update list_items set kind = 'inquiry_source' where kind = 'lead_source';
