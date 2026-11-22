-- =====================================================================
-- 026 — Next action presets
--
-- The quick-pick gaps on the next-action card (Tomorrow, +3 days, +1
-- week, +1 month) were hard-coded in three components, which had already
-- drifted: Log contact offered +14d and the card did not. One setting
-- now feeds all of them.
--
-- Stored as an int array of day offsets rather than rows in list_items:
-- these are numbers with no name, description, sort order or archive
-- state, and a list row would be four unused columns per preset.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table settings
  add column if not exists next_action_presets integer[] not null default '{1,3,7,30}';

-- A preset of 0 or less would book a callback in the past on every click,
-- and beyond a year the button is noise.
--
-- Written with `<= all(...)` rather than a NOT EXISTS over unnest: a check
-- constraint may not contain a subquery, and `scalar op all (array)` is a
-- plain expression that says the same thing.
--
-- cardinality rather than array_length, because array_length('{}', 1)
-- returns NULL, and a NULL check passes — an empty preset list would have
-- slipped through and left the card with no quick picks at all.
alter table settings drop constraint if exists settings_next_action_presets_sane;
alter table settings add constraint settings_next_action_presets_sane
  check (
    cardinality(next_action_presets) between 1 and 8
    and 1 <= all (next_action_presets)
    and 365 >= all (next_action_presets)
  );
