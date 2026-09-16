-- =====================================================================
-- 005 — Pay period setting + editable theme overrides
--
-- Two independent, additive settings columns, shipped together since both
-- land on the same table:
--
--   pay_period_start_day — 0=Sunday..6=Saturday, default 5 (Friday). Drives
--   the home screen's "Next payout": commission from the most recent
--   occurrence of this weekday through today, inclusive.
--
--   theme_overrides — JSON object of CSS custom-property overrides from the
--   Settings -> Appearance screen. Empty object means "use the shipped
--   defaults in globals.css's @theme block for everything." Only tokens the
--   dispatcher has actually changed are stored.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table settings add column if not exists pay_period_start_day integer not null default 5;
alter table settings add column if not exists theme_overrides jsonb not null default '{}'::jsonb;
