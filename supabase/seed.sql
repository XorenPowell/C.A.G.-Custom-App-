-- =====================================================================
-- C.A.G. Application — seed data
-- Run AFTER schema.sql. Safe to re-run (idempotent on list names).
-- Every value here is editable later from the Settings screen.
-- =====================================================================

insert into settings (id) values (true) on conflict (id) do nothing;
insert into google_credentials (id) values (true) on conflict (id) do nothing;

-- ---------- service categories ----------------------------------------
insert into list_items (kind, name, sort_order) values
  ('service_category','Moving',            10),
  ('service_category','Cleaning',          20),
  ('service_category','Junk Removal',      30),
  ('service_category','Handyman',          40),
  ('service_category','Yard Work',         50),
  ('service_category','Tech Consultation', 60),
  ('service_category','Need-A-Guy',        70)
on conflict do nothing;

-- ---------- lead sources ----------------------------------------------
-- 'Partnership Referral' is special-cased in the job form: selecting it
-- reveals the partnership picker. Renaming it in Settings is fine — the app
-- matches on the row's id, which is looked up by this exact name at seed time.
insert into list_items (kind, name, sort_order) values
  ('lead_source','Craigslist',              10),
  ('lead_source','Facebook',                20),
  ('lead_source','Google Business Profile', 30),
  ('lead_source','Yelp',                    40),
  ('lead_source','F2F',                     50),
  ('lead_source','Partnership Referral',    60),
  ('lead_source','Repeat Customer',         70)
on conflict do nothing;

-- ---------- zones -------------------------------------------------------
insert into list_items (kind, name, description, sort_order) values
  ('zone','Chicago',
   'All ZIP codes within a 10-mile radius of the Loop.', 10)
on conflict do nothing;

-- ---------- vehicle types ----------------------------------------------
-- Not specified in the brief; seeded as a usable starting point. Edit freely.
insert into list_items (kind, name, sort_order) values
  ('vehicle_type','Cargo Van',     10),
  ('vehicle_type','Box Truck',     20),
  ('vehicle_type','Pickup Truck',  30),
  ('vehicle_type','SUV',           40),
  ('vehicle_type','Sedan',         50),
  ('vehicle_type','Trailer',       60),
  ('vehicle_type','No Vehicle',    70)
on conflict do nothing;

-- ---------- partnership statuses ---------------------------------------
insert into list_items (kind, name, sort_order) values
  ('partnership_status','Prospect',  10),
  ('partnership_status','Contacted', 20),
  ('partnership_status','Signed',    30),
  ('partnership_status','Inactive',  40)
on conflict do nothing;

-- ---------- partnership tiers ------------------------------------------
insert into list_items (kind, name, sort_order) values
  ('partnership_tier','Tier 1 – Passive Placement',   10),
  ('partnership_tier','Tier 2 – Active Referral',     20),
  ('partnership_tier','Tier 3 – Co-Marketing',        30),
  ('partnership_tier','Tier 4 – Embedded/System',     40),
  ('partnership_tier','Tier 5 – Reciprocal/Cross-Promo', 50),
  ('partnership_tier','Tier 6 – Digital/Online',      60)
on conflict do nothing;

-- ---------- message templates ------------------------------------------
-- Ten templates with empty bodies. Written by the dispatcher in Settings.
insert into message_templates (template_name, audience, body, sort_order)
select t.name, a.audience, '', t.ord
from   (values ('Deposit Paid',1),('Morning Of',2),('2 Hours Prior',3),
               ('15 Minutes Prior',4),('Arrival',5)) as t(name, ord)
cross join (values ('Customer'),('Worker')) as a(audience)
where not exists (
  select 1 from message_templates m
  where m.template_name = t.name and m.audience = a.audience
);
