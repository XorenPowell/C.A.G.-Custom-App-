-- =====================================================================
-- 031 — The order a day is walked in
--
-- A day's stops were ordered by due_at, which in practice means they
-- were not ordered at all: a run is booked by dropping fourteen visits
-- on a date, and they all land at 9:00. Sorting them into time slots
-- just shuffled fourteen identical timestamps.
--
-- The order is its own fact, so it gets its own column. Times stay for
-- the stops that genuinely have an appointment.
--
-- Null means "never sorted", and sorts after everything that has been,
-- so adding a stop to an already-ordered day puts it at the end rather
-- than silently in the middle.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table scheduled_actions
  add column if not exists sort_order integer;

create index if not exists scheduled_actions_run_order_idx
  on scheduled_actions (due_at, sort_order);
