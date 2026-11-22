-- =====================================================================
-- 028 — Retire the two fixed contact slots
--
-- partnerships carried poc_name/phone/email and secondary_poc_* — room
-- for exactly two people — while the contacts table already held any
-- number of them with roles. Two places storing the same thing, and the
-- form edited the slots while the panel above it edited the contacts.
--
-- 022 copied every slot that had a phone or an email into contacts. The
-- names with neither were skipped, by the rule that a contact without a
-- way to reach them is not a contact. That rule stands, but the names
-- are still worth something, so they move into the notes before the
-- slots stop being read: 53 primary and 36 secondary, across 64
-- partnerships.
--
-- The columns themselves are NOT dropped here. Nothing reads them after
-- this release; dropping them is a separate migration once that has had
-- time to prove true. Keeps this one reversible.
--
-- Run once. Safe to re-run — the marker line guards it.
-- =====================================================================

with slots as (
  select
    p.id,
    concat_ws(', ',
      case
        when nullif(trim(p.poc_name), '') is not null
         and nullif(trim(p.poc_phone), '') is null
         and nullif(trim(p.poc_email), '') is null
        then trim(p.poc_name)
      end,
      case
        when nullif(trim(p.secondary_poc_name), '') is not null
         and nullif(trim(p.secondary_poc_phone), '') is null
         and nullif(trim(p.secondary_poc_email), '') is null
        then trim(p.secondary_poc_name)
      end
    ) as names
  from partnerships p
)
update partnerships p
   set notes = case
         when coalesce(nullif(trim(p.notes), ''), '') = ''
           then 'Former contact slots: ' || s.names
         else p.notes || E'\n' || 'Former contact slots: ' || s.names
       end
  from slots s
 where s.id = p.id
   and s.names <> ''
   and coalesce(p.notes, '') not like '%Former contact slots:%';

comment on column partnerships.poc_name is
  'Unused since 028. Contacts live in the contacts table. Dropped in a later migration.';
comment on column partnerships.secondary_poc_name is
  'Unused since 028. Contacts live in the contacts table. Dropped in a later migration.';
