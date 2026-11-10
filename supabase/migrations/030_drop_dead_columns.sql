-- =====================================================================
-- 030 — Drop what 028 and 029 stopped reading
--
-- THIS ONE IS NOT REVERSIBLE. Everything here has been unused since the
-- release that shipped 028 and 029, and the data that mattered was moved
-- first: the contact names into partnerships.notes, the card totals and
-- visit dates into the activity trail.
--
-- Run it only once that release has been live long enough to trust. It
-- is deliberately a separate file so the two can be run weeks apart.
--
-- Before running, these should all return 0:
--
--   select count(*) from partnerships
--    where total_cards_dropped > 0
--      and id not in (select partnership_id from activity
--                      where cards_dropped is not null
--                        and partnership_id is not null);
--
--   select count(*) from partnerships
--    where last_visit is not null
--      and id not in (select partnership_id from activity
--                      where kind = 'visit' and partnership_id is not null);
--
-- Run once. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The two fixed contact slots. Replaced by the contacts table in 022,
-- stopped being read in 028, names without a phone or email preserved
-- into notes by that same migration.
-- ---------------------------------------------------------------------
alter table partnerships
  drop column if exists poc_name,
  drop column if exists poc_phone,
  drop column if exists poc_email,
  drop column if exists secondary_poc_name,
  drop column if exists secondary_poc_phone,
  drop column if exists secondary_poc_email;

-- ---------------------------------------------------------------------
-- The card and visit running totals. Replaced by dated rows on activity
-- in 029, which seeded them so the sums match.
-- ---------------------------------------------------------------------
alter table partnerships
  drop column if exists last_visit,
  drop column if exists cards_dropped_last_visit,
  drop column if exists total_cards_dropped;

-- ---------------------------------------------------------------------
-- Fliers. Not tracked in this app at all: one partnership of 111 ever
-- had a non-zero count, and that count was never read anywhere.
-- ---------------------------------------------------------------------
alter table partnerships
  drop column if exists fliers_dropped_last_visit,
  drop column if exists total_fliers_dropped;

-- ---------------------------------------------------------------------
-- The maturity meter's goal, left in place by 022 to keep that migration
-- reversible. The meter went in the same release.
-- ---------------------------------------------------------------------
alter table settings
  drop column if exists mature_partnership_goal_per_zone;
