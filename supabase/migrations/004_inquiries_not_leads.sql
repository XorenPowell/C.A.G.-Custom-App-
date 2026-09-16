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
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table jobs rename column lead_source_id to inquiry_source_id;
alter index if exists jobs_lead_source_idx rename to jobs_inquiry_source_idx;

alter table settings rename column daily_leads_goal to daily_inquiries_goal;

update list_items set kind = 'inquiry_source' where kind = 'lead_source';

alter table list_items drop constraint if exists list_items_kind_check;
alter table list_items add constraint list_items_kind_check check (kind in (
  'service_category','inquiry_source','zone',
  'vehicle_type','partnership_status','partnership_tier'));
