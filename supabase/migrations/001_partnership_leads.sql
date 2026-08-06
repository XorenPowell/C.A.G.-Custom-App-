-- =====================================================================
-- 001 — Partnership lead management
--
-- Partnership leads now live alongside real partnerships. The
-- discriminator is `date_signed`: null means it is still a lead and it
-- stays out of every metric; set means it is a real partnership.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

-- `date_added` recorded when the row was typed in, which is not the same
-- as when the business actually signed. `created_at` already captures the
-- former automatically, so the column is repurposed rather than duplicated.
alter table partnerships rename column date_added to date_signed;

alter table partnerships alter column date_signed drop default;
alter table partnerships alter column date_signed drop not null;

-- Existing rows inherited today's date from the old default, which would
-- read as "every lead signed today". Blank them; the genuinely signed ones
-- get their real date re-entered by hand.
update partnerships set date_signed = null;

-- Any outreach: call, email, or an in-person visit.
alter table partnerships add column if not exists last_contact date;

-- "Follow up in N days". The due date is computed from last_contact on
-- read and is never stored.
alter table partnerships add column if not exists follow_up_days integer;

create index if not exists partnerships_date_signed_idx on partnerships (date_signed);
create index if not exists partnerships_last_contact_idx on partnerships (last_contact);

-- ---------------------------------------------------------------------
-- Pipeline statuses. Replaces the original seed, which had no lead stages.
-- ---------------------------------------------------------------------
delete from list_items
where kind = 'partnership_status'
  and lower(name) in ('prospect', 'contacted', 'signed', 'inactive')
  and not exists (
    select 1 from partnerships p where p.status_id = list_items.id
  );

insert into list_items (kind, name, sort_order) values
  ('partnership_status', 'Pending Contact', 10),
  ('partnership_status', 'Called',          20),
  ('partnership_status', 'Visited',         30),
  ('partnership_status', 'Signed',          40),
  ('partnership_status', 'Rejected',        50)
on conflict do nothing;
