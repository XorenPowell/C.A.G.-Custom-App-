-- =====================================================================
-- 002 — Equipment preset library
--
-- Backs the autocomplete on the entity Equipment section. Editable from
-- Settings, so items can be added or reworded without a code change.
--
-- `category` is not in the original spec but 260-odd rows in one flat list
-- is unusable to edit or browse; it drives the Settings filter and groups
-- the autocomplete. Bundles sort first because they are the whole point —
-- one row instead of twenty.
--
-- Run once in the Supabase SQL Editor. The rows themselves are loaded by
-- `node scripts/seed-equipment.mjs .env.local`.
-- =====================================================================

create table if not exists equipment_presets (
  id           uuid primary key default gen_random_uuid(),
  item_name    text not null,
  default_note text,
  category     text not null default 'Other',
  sort_order   integer not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists equipment_presets_name_idx
  on equipment_presets (lower(item_name));
create index if not exists equipment_presets_category_idx
  on equipment_presets (category, sort_order);

drop trigger if exists equipment_presets_updated_at on equipment_presets;
create trigger equipment_presets_updated_at before update on equipment_presets
  for each row execute function set_updated_at();

alter table equipment_presets enable row level security;

drop policy if exists equipment_presets_authenticated_all on equipment_presets;
create policy equipment_presets_authenticated_all on equipment_presets
  for all to authenticated using (true) with check (true);

-- Roster-wide equipment search covers notes as well as the item name, so
-- searching "dolly" finds a crew carrying a General Moving Kit.
create index if not exists entity_equipment_notes_idx
  on entity_equipment (lower(notes));
