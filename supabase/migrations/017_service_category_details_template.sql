-- =====================================================================
-- 017 — Details pre-fill per service category
--
-- Adds an optional details_template to list_items, settable in Settings
-- for service_category entries. When a job's service category is picked,
-- the job form pre-fills the Details section from it — but only when
-- Details is still empty, so it never overwrites existing text.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table list_items add column if not exists details_template text;
