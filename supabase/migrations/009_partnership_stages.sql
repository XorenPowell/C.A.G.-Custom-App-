-- =====================================================================
-- 009 — Partnership stages replace the signed/lead pipeline
--
-- date_signed used to be the lead/partner switch: null meant "lead," set
-- meant "counts." Nothing is ever actually signed — a partnership matures
-- through repeated visits instead. Status becomes that progression:
-- Visited -> Developing -> Mature. Whatever Status values existed before
-- are retired (archived, not deleted) since the field's meaning has
-- changed, and every partnership is reassigned into the new progression:
-- had a signed date -> Mature, otherwise -> Visited. Tier is untouched —
-- it's a separate axis (e.g. digital vs. bulletin-board partner).
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

-- Retire whatever Status values existed before — their meaning no longer applies.
update list_items set archived = true
  where kind = 'partnership_status'
    and lower(name) not in ('visited', 'developing', 'mature');

-- Seed the three stages if they aren't already there.
insert into list_items (kind, name, sort_order)
select 'partnership_status', v.name, v.sort_order
from (values ('Visited', 10), ('Developing', 20), ('Mature', 30)) as v(name, sort_order)
where not exists (
  select 1 from list_items
  where kind = 'partnership_status' and lower(name) = lower(v.name)
);

-- Make sure they're active even if a prior partial run archived them.
update list_items set archived = false
  where kind = 'partnership_status' and lower(name) in ('visited', 'developing', 'mature');

-- Backfill every partnership into the new progression, overwriting whatever
-- Status was set before — that field now means something different.
update partnerships p
set status_id = (
  select id from list_items where kind = 'partnership_status' and lower(name) = 'mature'
)
where p.date_signed is not null;

update partnerships p
set status_id = (
  select id from list_items where kind = 'partnership_status' and lower(name) = 'visited'
)
where p.date_signed is null;

-- The signed-date gate is gone; Status now carries this meaning.
drop index if exists partnerships_date_signed_idx;
alter table partnerships drop column if exists date_signed;
