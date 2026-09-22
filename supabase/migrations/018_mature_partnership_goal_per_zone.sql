-- =====================================================================
-- 018 — Mature-partnership goal per zone
--
-- A single target (default 30) every zone is measured against on the
-- Partnerships screen's zone-maturity card: count of that zone's
-- Mature-status partnerships, divided by this target.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table settings add column if not exists mature_partnership_goal_per_zone integer not null default 30;
