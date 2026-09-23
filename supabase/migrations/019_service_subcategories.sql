-- =====================================================================
-- 019 — Service category hierarchy + flat rates
--
-- service_category list_items can now nest one level: parent_id null =
-- a top-level category, parent_id set = a subcategory under it. Going
-- forward, jobs and entity_rates reference SUBCATEGORIES (the rate-
-- bearing, dispatchable unit); entity_references keep referencing the
-- TOP-LEVEL category (a reference is "verified for Moving", not scoped
-- to a specific subcategory).
--
-- Also adds entity_rates.flat_rate: an entity can have an hourly rate
-- (regular/travel/other, as before) and/or a flat rate for the same
-- subcategory — whichever's configured, the dispatcher picks per job.
--
-- Backfill: every existing service_category currently has jobs and
-- entity_rates pointing at it directly (there are no subcategories
-- yet). This creates a "General" subcategory under each existing
-- category and repoints those jobs/entity_rates onto it, so nothing
-- breaks — rename "General" or split it into real subcategories later.
-- entity_references are left pointing at the category, unchanged.
--
-- Run once in the Supabase SQL Editor. Safe to re-run (the backfill
-- loop only creates a "General" subcategory where a category doesn't
-- already have children).
-- =====================================================================

alter table list_items add column if not exists parent_id uuid references list_items(id) on delete cascade;
create index if not exists list_items_parent_idx on list_items (parent_id);

alter table entity_rates add column if not exists flat_rate numeric(12,2) not null default 0;

-- Subcategory names only need to be unique within their own category, but
-- list_items' existing name uniqueness (list_items_kind_name_idx) is global
-- per kind — so the backfilled name is prefixed with its category's name
-- to guarantee no collision (e.g. "Moving — General", "Junk Removal — General").
do $$
declare
  cat record;
  new_sub_id uuid;
begin
  for cat in
    select id, name from list_items
    where kind = 'service_category' and parent_id is null
  loop
    if not exists (select 1 from list_items where parent_id = cat.id) then
      insert into list_items (kind, name, parent_id, sort_order, archived)
      values ('service_category', cat.name || ' — General', cat.id, 10, false)
      returning id into new_sub_id;

      update jobs set service_category_id = new_sub_id where service_category_id = cat.id;
      update entity_rates set service_category_id = new_sub_id where service_category_id = cat.id;
    end if;
  end loop;
end $$;
