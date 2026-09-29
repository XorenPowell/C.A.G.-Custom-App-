-- =====================================================================
-- 020 — Follow-up date/time on jobs
--
-- A single optional timestamp per job — when the dispatcher needs to call
-- the lead back. No callback set means it never shows up anywhere. When
-- set, it's the sole source for the Home screen's "Calls Today" section.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table jobs add column if not exists follow_up_at timestamptz;
create index if not exists jobs_follow_up_at_idx on jobs (follow_up_at);
