-- =====================================================================
-- 032 — Counted stock
--
-- The balance is derived: collected minus dropped. That only works if
-- both sides are complete, and they are not — the drops seeded in 029
-- came from a sheet that was not kept every day, so the screen reads
-- 1,227 when the boot actually holds about 450.
--
-- Rather than let the number drift, a count is recordable: "today I have
-- 450". It is stored as a correction line in the same ledger — the
-- signed difference between what was counted and what the ledger
-- believed at that moment — so nothing is rewritten, the gap stays
-- visible, and every drop logged afterwards subtracts from the corrected
-- figure the way it always did.
--
-- Stored in card_receipts rather than a table of its own: both are
-- dated lines that move the balance, and two tables would mean two
-- reads, two sorts and two sets of RLS to say the same thing.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table card_receipts
  add column if not exists kind text not null default 'receipt';

-- What was actually counted (450), kept beside the correction so the
-- line can say what was seen rather than only what it adjusted by.
alter table card_receipts
  add column if not exists counted_total integer;

alter table card_receipts drop constraint if exists card_receipts_kind_check;
alter table card_receipts add constraint card_receipts_kind_check
  check (kind in ('receipt', 'count'));

-- A collection of zero cards is a typo. A count that agrees exactly with
-- the ledger is a correction of zero, and worth keeping as proof the
-- numbers were checked on that date.
--
-- 029 wrote the old rule inline, so Postgres named it. Dropping by any
-- name that mentions quantity rather than by the one it probably got:
-- if the guess were wrong the old constraint would survive, the new one
-- would be added beside it, and a count of exactly zero would still be
-- refused -- by a rule nothing in the file mentions.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'card_receipts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%quantity%'
  loop
    execute format('alter table card_receipts drop constraint %I', c.conname);
  end loop;
end $$;

alter table card_receipts add constraint card_receipts_quantity_check
  check (quantity <> 0 or kind = 'count');

-- A count carries the figure it saw; a collection does not.
alter table card_receipts drop constraint if exists card_receipts_counted_total_check;
alter table card_receipts add constraint card_receipts_counted_total_check
  check (
    (kind = 'count' and counted_total is not null and counted_total >= 0)
    or (kind = 'receipt' and counted_total is null)
  );
