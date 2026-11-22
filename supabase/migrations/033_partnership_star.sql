-- =====================================================================
-- 033 — Starred partnerships
--
-- Stage says how far along a partnership is and tier says how big it
-- could be, but neither says "this one matters to me". That judgement
-- was being carried in someone's head, which meant the list could not
-- be ordered by it.
--
-- A star is deliberately a plain boolean rather than a 1-5 rating: the
-- question being answered is "is this one of the ones I care about",
-- and a scale invites grading every row instead of marking a few.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table partnerships
  add column if not exists starred boolean not null default false;

-- Sorting by importance reads starred rows first every time, and there
-- will only ever be a handful of them.
create index if not exists partnerships_starred_idx
  on partnerships (starred)
  where starred;

-- PostgREST answers from a cached copy of the schema and does not always
-- notice new columns on its own.
notify pgrst, 'reload schema';
