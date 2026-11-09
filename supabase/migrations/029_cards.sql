-- =====================================================================
-- 029 — Cards as a ledger, restocks as visits
--
-- Three things were tangled together:
--
--   1. A restock was its own activity kind, while a restock is simply a
--      visit to a business that happens to have a stack. Two kinds for
--      one event meant two queues, two lists and two places to look.
--   2. Cards lived as running totals on partnerships
--      (cards_dropped_last_visit, total_cards_dropped), so the app knew
--      how many had been dropped but never when, and nothing knew how
--      many were left in the boot.
--   3. Cards handed over face to face were not counted at all.
--
-- After this: a visit carries the cards dropped on it, every drop is
-- dated, and a Cards balance is receipts in minus drops out.
--
-- Run once. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A visit carries its cards
--
-- cards_found is the restock observation: how many were still sitting
-- there on arrival. The pick-up estimate derives from it — the previous
-- drop minus what was still there, over the days between — which is why
-- it belongs to the visit and not to the placement. The placement only
-- ever knows the latest figure; the visit knows it for that day.
-- ---------------------------------------------------------------------
alter table activity
  add column if not exists cards_dropped integer,
  add column if not exists cards_found   integer;

alter table activity drop constraint if exists activity_cards_sane;
alter table activity add constraint activity_cards_sane
  check (
    (cards_dropped is null or cards_dropped between 0 and 10000)
    and (cards_found is null or cards_found between 0 and 10000)
  );

-- ---------------------------------------------------------------------
-- 2. Cards handed over face to face
-- ---------------------------------------------------------------------
alter table face_to_face_conversations
  add column if not exists cards_dropped integer not null default 0;

alter table face_to_face_conversations drop constraint if exists f2f_cards_sane;
alter table face_to_face_conversations add constraint f2f_cards_sane
  check (cards_dropped between 0 and 100);

-- Per-outcome default, alongside default_intent_level from 012. "Took a
-- card" hands over one; "Not interested" hands over none; the dispatcher
-- sets which is which rather than the app guessing.
alter table list_items add column if not exists default_cards integer;

alter table list_items drop constraint if exists list_items_default_cards_check;
alter table list_items add constraint list_items_default_cards_check
  check (default_cards is null or default_cards between 0 and 100);

-- ---------------------------------------------------------------------
-- 3. Cards received
--
-- The other half of the ledger. Without it the app can say how many
-- cards went out but never how many are left, which is the only
-- question actually asked of it.
-- ---------------------------------------------------------------------
create table if not exists card_receipts (
  id           uuid primary key default gen_random_uuid(),
  received_on  date not null,
  quantity     integer not null check (quantity <> 0),
  source       text,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists card_receipts_date_idx on card_receipts (received_on desc);

alter table card_receipts enable row level security;
drop policy if exists card_receipts_authenticated_all on card_receipts;
create policy card_receipts_authenticated_all on card_receipts
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 4. Restock stops being a kind of its own
--
-- Existing restock rows become visits and keep everything else. The
-- check constraint is widened first so the update cannot fail against a
-- stale constraint, then narrowed once nothing uses the old value.
-- ---------------------------------------------------------------------
-- The original constraint was declared inline in 022, so Postgres named
-- it. Found by what it checks rather than by a guessed name.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'activity'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%restock%'
  loop
    execute format('alter table activity drop constraint %I', c);
  end loop;
end $$;

update activity set kind = 'visit' where kind = 'restock';

alter table activity drop constraint if exists activity_kind_check;
alter table activity add constraint activity_kind_check
  check (kind in ('call','text','email','visit','note'));

-- scheduled_actions never allowed 'restock' (024 listed four kinds), so
-- there is nothing to convert there.

-- ---------------------------------------------------------------------
-- 5. Bring the old visits into the history
--
-- partnerships.last_visit and cards_dropped_last_visit recorded one
-- visit each with no way to see it. They become real visit entries, so
-- the trail finally shows what the totals were counting.
--
-- Guarded by the outcome text so a re-run does not double the history.
-- ---------------------------------------------------------------------
insert into activity (partnership_id, kind, outcome, occurred_at, cards_dropped)
select p.id,
       'visit',
       'Visit recorded before the activity log existed',
       (p.last_visit + time '12:00') at time zone 'America/Chicago',
       -- Capped at the business's recorded total. One partnership has a
       -- last-visit drop larger than its total, which is simply an
       -- inconsistency in the old sheet; the total is the figure that was
       -- maintained, so it wins and the ledger never claims more cards
       -- went out than were ever counted.
       nullif(least(coalesce(p.cards_dropped_last_visit, 0), p.total_cards_dropped), 0)
  from partnerships p
 where p.last_visit is not null
   and not exists (
     select 1 from activity a
      where a.partnership_id = p.id
        and a.outcome = 'Visit recorded before the activity log existed'
   );

-- ---------------------------------------------------------------------
-- 6. The cards those visits never accounted for
--
-- total_cards_dropped counts every card ever left at a business, while
-- cards_dropped_last_visit counts only the most recent drop. The
-- difference was dropped on visits nobody recorded the date of, so it
-- lands as one opening entry per business rather than being quietly lost
-- or pretended to belong to the last visit.
--
-- Together with step 5 this holds an invariant worth stating: for every
-- partnership, the cards on its seeded rows sum to exactly
-- total_cards_dropped. Nothing is invented and nothing is dropped.
-- ---------------------------------------------------------------------
insert into activity (partnership_id, kind, outcome, occurred_at, cards_dropped)
select p.id,
       'note',
       'Cards dropped before the activity log existed',
       (coalesce(p.last_visit, p.created_at::date) + time '11:00') at time zone 'America/Chicago',
       p.total_cards_dropped - carried.n
  from partnerships p
 cross join lateral (
   -- Exactly what the visit row above carried for this business, which is
   -- nothing at all when there was no last_visit to hang a visit on. The
   -- earlier version subtracted the last-visit drop regardless, so four
   -- businesses with cards but no recorded visit date silently lost them.
   select case when p.last_visit is null then 0
               else least(coalesce(p.cards_dropped_last_visit, 0), p.total_cards_dropped)
          end as n
 ) carried
 where p.total_cards_dropped - carried.n > 0
   and not exists (
     select 1 from activity a
      where a.partnership_id = p.id
        and a.outcome = 'Cards dropped before the activity log existed'
   );

-- ---------------------------------------------------------------------
-- 7. The stack counts we do have
--
-- cards_left on a placement is the latest observation and nothing more.
-- It is copied onto the most recent visit for that business so the
-- pick-up estimate has a starting point, and left on the placement so
-- the card keeps working.
-- ---------------------------------------------------------------------
update activity a
   set cards_found = pl.cards_left
  from campaign_placements pl
 where pl.partnership_id = a.partnership_id
   and pl.removed_on is null
   and pl.cards_left is not null
   and a.cards_found is null
   and a.kind = 'visit'
   and a.occurred_at = (
     select max(a2.occurred_at) from activity a2
      where a2.partnership_id = a.partnership_id and a2.kind = 'visit'
   );

-- ---------------------------------------------------------------------
-- Note on what is NOT dropped here
--
-- last_visit, cards_dropped_last_visit and total_cards_dropped stay as
-- they are. Nothing reads them after this release; they go in 030 once
-- that has had time to prove true, which keeps this migration
-- reversible.
-- ---------------------------------------------------------------------
comment on column partnerships.total_cards_dropped is
  'Unused since 029. Cards are summed from activity.cards_dropped. Dropped in a later migration.';
