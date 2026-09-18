-- =====================================================================
-- 013 — Job details field
--
-- Separate from Notes: meant to be dropped into message templates via
-- {{details}} (parking instructions, gate codes, access notes, etc.),
-- not just kept internal like Notes is.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table jobs add column if not exists details text;
