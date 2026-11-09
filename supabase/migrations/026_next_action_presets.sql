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
alter table settings drop constraint if exists settings_next_action_presets_sane;
alter table settings add constraint settings_next_action_presets_sane
  check (
    array_length(next_action_presets, 1) between 1 and 8
    and not exists (
      select 1 from unnest(next_action_presets) d where d < 1 or d > 365
    )
  );
