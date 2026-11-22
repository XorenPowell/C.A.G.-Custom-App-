# V2 Data Map — the build sheet for V2's SQL

> **For the Claude writing the SQL — read this box first.**
> You are writing Supabase (Postgres) migrations for CAGC V2, a jobs-and-dispatch app with four roles:
> Customer, Worker, Dispatcher, Local Admin. This file is the full specification. Everything you need is here;
> the design source is the Obsidian canvas `CAG   APP DESIG.canvas` (branch 4 DATA, branch 5 RULES), cited as "canvas x.y.z".
>
> **What to produce:** one file per row of the migration table (§2), in `supabase/migrations/`, named exactly as listed.
> Each file starts with a comment block saying **what it adds and why** (one short paragraph, plain English),
> then the SQL. Every new table gets a `comment on table` with its purpose, and every column whose name is not
> self-explanatory gets a `comment on column`. Use `if not exists` / `drop … if exists` so a file can be re-run safely.
>
> **Before writing:** read `supabase/schema.sql` (the V1 schema, migrations 001–021) **and** migrations 022–033 (the SMT redesign:
> `activity`, `contacts`, `campaigns`, `campaign_placements`, `card_receipts`, `scheduled_actions`, `follow_up_kind`, …),
> which together are the live database before V2. Then you know the existing
> tables, triggers, views and the `set_updated_at()` helper you should reuse.
>
> **Do not:** edit or re-run `schema.sql`, rename or drop anything that already exists, or change V1 views
> (`job_worker_pay`, `job_financials`). Make new `v2_` views instead.

Written 2026-11-21, reorganised by role 2026-11-22.

---

## 0. Ground rules

1. **Additive only.** New migrations start at `034_`. Add tables, columns, views, functions, policies.
   Never rename or drop anything the browser app (Next.js, `src/app/actions/*`) reads.
   Cleanup (drops, renames, merging duplicates) happens in a later pass, once V2 clearly works (canvas 5.3.3).
2. **Two front ends, one database.** The browser app keeps running. The Expo phone app is added (later publishing to
   app store — after publishing, both the browser version and app will use the same database). Any change must leave
   the browser app working: new columns are nullable or have a default; widened `check` constraints are supersets of the old ones.
3. **`schema.sql` stays the V1 snapshot.** Don't re-run it — it drops everything. V2 lives only in numbered migrations.
4. **Test first.** Run every migration on a test copy (a Supabase branch or a separate dev project) before the live project.
5. **Money and logic live in SQL** (canvas 5.3.6): views for derived figures, RPC functions for actions, RLS for access.
6. **Customers and workers never read base tables that hold money or other people's data.** They read through
   views / RPCs that return only their columns. Staff (Dispatcher, Local Admin) read base tables.
7. **Lists come from `list_items`** (add new `kind`s), never hard-coded.
8. **Types.** Times are `timestamptz` (display in America/Chicago); dates are `date`; money is `numeric(12,2)` USD;
   ids are `uuid primary key default gen_random_uuid()`; every new table has `created_at timestamptz not null default now()`,
   and editable ones also `updated_at` with the `set_updated_at()` trigger.
9. **Cities:** not built yet (canvas 5.3.7). Don't add a city column now.
10. **Square:** no API yet. The dispatcher pastes the invoice link and sets the status by hand. Leave nullable
    `square_invoice_id` / `last_synced_at` columns for when the API goes in.
11. **Each role's data lives in its own tables.** A column that applies to only one role never goes on a table every
    role shares. Shared things (jobs) link to role tables by id. See §1.

### ⚠ The one change that is not "just adding"
V1's RLS lets **any signed-in user read and write every table** (`*_authenticated_all` policies).
The moment a customer or worker account exists, they could see everything. So, in this order:
1. `034` creates `profiles` and backfills every existing `auth.users` row as `local_admin` (the owner, on the browser app).
2. `035` swaps each `*_authenticated_all` policy for a **staff-only** policy (`is_staff()`).
   The browser app keeps working because its users are staff.
3. Only after that are customer or worker accounts created.

---

## 1. How the data is organised (the "drawers")

One database. Each role has its own drawers (tables). Jobs sit in the middle and point at the role drawers by id,
so every role works from the same job without copying it.

```
                 ┌──────────────────── EVERYONE ─────────────────────┐
                 │ profiles (login + contact, one row per account)    │
                 │ signed_agreements · push_tokens · module_grants    │
                 └───────┬───────────────┬───────────────┬───────────┘
                         │               │               │
        ┌──── WORKER ────┴──┐   ┌─ CUSTOMER ─┴─┐   ┌─ STAFF (Dispatcher / Local Admin) ─┐
        │ entities (roster) │   │ customer_    │   │ time_entries · face_to_face_*       │
        │ entity_documents  │   │ details      │   │ partnerships · contacts · activities│
        │ entity_rates/fees │   │              │   │ placements · cards · visit days     │
        │ entity_equipment  │   │              │   │ report_definitions · settings/lists │
        │ entity_unavail.   │   │              │   │                                     │
        │ worker_templates  │   │              │   │                                     │
        │ payouts · tax     │   │              │   │                                     │
        │ rating_events     │   │              │   │                                     │
        └─────────┬─────────┘   └──────┬───────┘   └──────────────────┬──────────────────┘
                  │ crew seat          │ customer link                │ owner dispatcher
                  ▼                    ▼                              ▼
        ┌──────────────────────────── SHARED: JOBS ────────────────────────────────────┐
        │ jobs · job_stops · job_needs · job_pool · job_offers · job_workers (crew)    │
        │ job_slides · job_photos · job_expenses · job_events · job_checklist_items    │
        │ customer_payments (Square link) · job_signoffs · job_status_events           │
        └──────────────────────────────────────────────────────────────────────────────┘
```

- A worker's "My jobs" = jobs where their entity is on the crew (`job_workers`).
- A customer's "My jobs" = jobs whose `customer_profile_id` is their account.
- A dispatcher's jobs = jobs whose `owner_dispatcher_id` is them.

---

## 2. Migration order

| # | File | What it adds |
|---|---|---|
| 034 | `034_profiles_and_roles.sql` | `profiles`, helper functions, backfill existing users as `local_admin` |
| 035 | `035_staff_only_rls.sql` | Replace every `*_authenticated_all` policy with a staff-only one |
| 036 | `036_lists_and_settings.sql` | New `list_items` kinds, `settings` columns, `category_questions`, `fee_catalog` |
| 037 | `037_agreements_and_customers.sql` | `agreement_texts`, `signed_agreements`, `customer_details` |
| 038 | `038_worker_records.sql` | `entities` additions, `entity_documents`, `entity_unavailability`, `worker_templates`, rating tables |
| 039 | `039_jobs_v2_columns.sql` | Wider job status; payer / on-site; quote type; site details; owner; ending reason; customer link |
| 040 | `040_dispatch_and_work.sql` | `job_stops`, `job_needs`, `job_pool`, `job_offers`, `job_workers` additions, `job_slides`, `job_photos`, `job_events`, `worker_locations` |
| 041 | `041_money.sql` | `job_expenses`, `payouts`, `payout_corrections`, `customer_payments`, `worker_tax_years` |
| 042 | `042_field_sales.sql` | `partnerships` additions, `contacts`, `activities`, placements, card ledger, visit days |
| 043 | `043_comms.sql` | `job_checklist_items`, `message_log`, `notification_log`, `push_tokens`, `job_signoffs`, `job_worker_scores` |
| 044 | `044_admin.sql` | `module_grants`, `report_definitions`, `audit_log`, `job_status_events` |
| 045 | `045_views_and_rpcs.sql` | Role views, work queue, matching, take-offer, hours-from-slides, V2 money views |
| 046 | `046_role_rls.sql` | Row-level security for every new table, per §10 |
| 047 | `047_storage.sql` | Storage buckets and their policies |
| 048 | `048_role_access_fixes.sql` | Fixes after review: customer RPCs (`create_job_request`, `accept_quote`, `raise_job_event`), self sign-up profile + verified-channel job linking, worker RPCs (`give_back_job`, queue-aware `take_offer`, `hours_from_slides`) and slide/photo triggers that move job status, fuller `v_worker_jobs` / `v_customer_jobs`, `v_my_payouts`, `v_my_rates`, `v_app_settings`, readable lists, Chicago-time contact reveal, `job_workers.is_point_of_contact`, Local-Admin-only payouts, add-only slides/photos/expenses |

---

## 3. EVERYONE — accounts and access (canvas 4.9, 5.2, 5.5, 2.10)

### `profiles` — NEW (034)
**Purpose:** one row per login, whatever the role. Holds only what every account has. Nothing role-specific goes here.

| column | type | purpose |
|---|---|---|
| id | uuid pk, references `auth.users(id)` on delete cascade | the login |
| role | text not null, check in (`customer`,`worker`,`dispatcher`,`local_admin`) | one role per account (canvas 5.3.1) |
| status | text not null default `active`, check in (`active`,`deactivated`) | Deactivate / Reactivate (canvas 2.10.2) |
| full_name | text not null | |
| phone | text | |
| email | text | |
| notification_prefs | jsonb not null default `'{}'` | push / email choices |
| must_change_password | boolean not null default false | true for accounts the Local Admin creates (canvas 6.2.1, proposed) |
| created_by | uuid null, references `profiles(id)` | who made the account (null = self sign-up) |
| login_link_created_at | timestamptz null | when the admin made the login link |
| created_at, updated_at | timestamptz | |

Indexes: `lower(email)`, digits-only phone (`regexp_replace(coalesce(phone,''), '\D', '', 'g')`).

**Creating an account needs the Supabase admin API** (create the user, set the password, make the login link), so it
runs in a server function (Next.js server action or Supabase Edge Function) with the service-role key, never from the
phone. It then inserts `profiles`, inserts the role row (`entities` for a worker, `customer_details` for a customer),
and links the ticked jobs.

### Helper functions (034) — `security definer`, `stable`, `set search_path = public`
| function | returns | purpose |
|---|---|---|
| `my_role()` | text | the caller's role from `profiles` |
| `is_staff()` | boolean | caller is an active dispatcher or local_admin |
| `is_local_admin()` | boolean | caller is an active local_admin |
| `my_entity_id()` | uuid | the caller's worker record (`entities.profile_id = auth.uid()`) |
| `has_module(key text)` | boolean | caller's role or account is granted that module (`module_grants`) |

### `agreement_texts` — NEW (037)
**Purpose:** the wording of each agreement, versioned, so we always know exactly what someone signed (canvas 6.2.2).

| column | type | purpose |
|---|---|---|
| id | uuid pk | |
| kind | text not null, check in (`customer`,`ic`) | customer agreement or independent-contractor agreement |
| version | text not null | e.g. `2026-11` ; unique (kind, version) |
| body | text not null | the full text shown to the signer |
| effective_from | date not null | |
| created_by | uuid references `profiles(id)` | |

### `signed_agreements` — NEW (037)
**Purpose:** who signed which agreement version, and when. A customer has a `customer` row once (canvas 2.7.2);
a worker has an `ic` row. Nobody carries agreement fields that don't apply to them.

| column | type | purpose |
|---|---|---|
| id | uuid pk | |
| agreement_text_id | uuid not null references `agreement_texts(id)` | the exact version signed |
| profile_id | uuid not null references `profiles(id)` | the signer |
| job_id | uuid null references `jobs(id)` | the job it was signed on (customer: their first job) |
| signed_name | text not null | name typed when signing |
| signed_at | timestamptz not null default now() | |

Unique (profile_id, agreement_text_id). A worker's IC agreement can also be an uploaded file in `entity_documents`
(doc type `ic_agreement`); the Paperwork screen shows it as signed if either exists.

### `module_grants` — NEW (044)
**Purpose:** extra modules given to a whole role or to one account (canvas 4.12.6, 5.5.1).
`id uuid pk, module_key text not null, role text null, profile_id uuid null references profiles(id), granted_by uuid references profiles(id), granted_at timestamptz default now()`
— check exactly one of `role` / `profile_id` is set.

### `push_tokens` — NEW (043)
**Purpose:** where to send push notifications for each account's devices.
`id uuid pk, profile_id uuid not null references profiles(id) on delete cascade, expo_push_token text not null unique, platform text, updated_at timestamptz`

### `notification_log` — NEW (043)
**Purpose:** every push or email the app sent to an account, and whether it arrived (canvas 4.15).
`id uuid pk, recipient_id uuid not null references profiles(id), channel text check in ('push','email'), job_id uuid null references jobs(id), content_ref text, sent_at timestamptz default now(), status text default 'sent' check in ('sent','failed','read')`

### Account matching (canvas 2.10.1, 2.10.4) — RPCs (045)
- `match_jobs_for_contact(p_name text, p_phone text, p_email text)` → `job_id, job_number, job_date, service, matched_on text[]`.
  Phone compares digits only; email and name compare `lower(trim())`. Checks payer **and** on-site contact. Local Admin only.
- `link_jobs_to_account(p_profile uuid, p_job_ids uuid[])` → sets `jobs.customer_profile_id`, `customer_linked_by`,
  `customer_linked_at`, `customer_linked_via = 'admin'`. Local Admin only.
- **Self sign-up (no admin step):** a trigger on `auth.users` fires when `phone_confirmed_at` or `email_confirmed_at`
  is first set, and links every unlinked job whose payer or on-site **phone** matches the verified phone, or whose payer
  **email** matches the verified email. Each channel links on its own — a job matching only the email stays hidden until
  the email is confirmed. Name never links on its own. Sets `customer_linked_via` to `phone_verified` / `email_verified`.

---

## 4. WORKER — the worker's own records (canvas 4.8, 4.11, 4.17, 2.7)

A worker account (`profiles.role = 'worker'`) owns one **entity**: the roster record. Everything below hangs off the entity.

### `entities` (V1) — add columns (038)
**Purpose (V1):** one unit of labour — an individual, a crew, or a vendor. V2 adds the worker's login link and profile details.

| new column | type | purpose |
|---|---|---|
| profile_id | uuid null unique references `profiles(id)` | the worker's login (null for roster-only records) |
| entity_kind | text null, check in (`individual`,`crew`,`vendor`) | V1 infers individual/crew from `roster_size` |
| photo_path | text null | storage path of the profile photo |
| home_address | text null | for travel time (canvas 2.2.2) |
| home_lat, home_lng | double precision null | |
| uses_public_transport | boolean not null default false | doubles travel time |
| payout_method | text null | e.g. Cash App, Zelle |
| payout_handle | text null | e.g. `$handle`; visible to the Local Admin |
| phone, email | — | **not added**: they live on `profiles` |

`status` stays `Active`/`Inactive` (shown as **Deactivated** in V2; don't rename the value).

### `entity_documents` — NEW (038)
**Purpose:** the worker's paperwork, each with its approval and expiry (canvas 4.8.5, 2.7.1). No reminders are sent;
"Expired" and "Expiring soon" are read from `expires_on`.

| column | type | purpose |
|---|---|---|
| id | uuid pk | |
| entity_id | uuid not null references `entities(id)` on delete cascade | |
| doc_type | text not null, check in (`w9`,`ic_agreement`,`photo_id`,`background_check`,`drivers_license`,`vehicle_insurance`,`liability_insurance`,`equipment_photo`,`verification_photo`) | |
| storage_path | text | file in the `documents` bucket |
| expires_on | date null | for documents that expire |
| status | text not null default `pending`, check in (`pending`,`approved`,`rejected`) | |
| reason | text null | why it was rejected (shown to the worker) |
| uploaded_by | uuid references `profiles(id)` | |
| uploaded_at | timestamptz default now() | |
| reviewed_by | uuid null references `profiles(id)` | |
| reviewed_at | timestamptz null | |

V1's `*_link` columns on `entities` stay for the browser app.
**Dispatchable** (view `v2_dispatchable_entities`, 045): entity Active, and `w9`, `ic_agreement`, `photo_id`,
`background_check` approved, and any `drivers_license` / `vehicle_insurance` on file approved and not expired.

### `entity_unavailability` — NEW (038)
**Purpose:** times the worker can't work; anything not blocked counts as available (canvas 4.8.4).
`id uuid pk, entity_id uuid not null references entities(id) on delete cascade, on_date date null, end_date date null, weekday smallint null check (weekday between 0 and 6), start_time time null, end_time time null, label text`
— check `on_date` or `weekday` is set; null times = all day.
⚠ V1's `entity_availability` means the **opposite** (available times). Leave it for the browser app.

### `worker_templates` — NEW (038)
**Purpose:** the worker's own Something's up text templates (canvas 4.12.3). Kept apart from the staff's `message_templates`.
`id uuid pk, entity_id uuid not null references entities(id) on delete cascade, kind text not null check in ('cant_make_it','running_late','cant_get_in','job_bigger','damage'), body text not null, updated_at timestamptz`
— unique (entity_id, kind). Placeholders `{dispatcher} {me} {job} {when} {minutes}` are filled by the app.

### Existing worker tables (V1)
- `entity_rates` — rates per service category: unchanged.
- `entity_fees` — add `fee_catalog_id uuid null references fee_catalog(id)` (036).
- `entity_equipment` — add `category text null` (038).
- `entity_references` — unchanged.

### `rating_rules` / `rating_events` — NEW (038) (canvas 4.12.6, 4.17)
- `rating_rules` **purpose:** the events that move a rating, editable by the Local Admin.
  `id uuid pk, event_key text unique, label text, delta numeric(4,2), active boolean default true`
- `rating_events` **purpose:** every change to a worker's rating, so the score can always be explained.
  `id uuid pk, entity_id uuid references entities(id), rule_id uuid references rating_rules(id), delta numeric(4,2), job_id uuid null references jobs(id), note text, created_by uuid, created_at timestamptz`
- Score = view `v2_entity_rating`: 10 + sum(delta), clamped 0–10.

### Worker money tables — see §7 (`payouts`, `payout_corrections`, `worker_tax_years`).

---

## 5. CUSTOMER — the customer's own records (canvas 4.9.4, 2.10.1)

A customer's data is mostly their jobs (linked through `jobs.customer_profile_id`) and their agreement
(`signed_agreements`). They need only one small table of their own.

### `customer_details` — NEW (037)
**Purpose:** customer-only facts about an account.
| column | type | purpose |
|---|---|---|
| profile_id | uuid pk references `profiles(id)` on delete cascade | the customer's login |
| default_address | text null | pre-fills a new request |
| customer_type | text null, check in (`Residential`,`Commercial`) | |
| notes | text null | staff-only notes about this customer |
| created_at, updated_at | timestamptz | |

A customer **record without an account** is just the payer details on their jobs (V1 behaviour); the customer
lookup screen groups jobs by digits-only phone.

---

## 6. STAFF — Dispatcher and Local Admin records (canvas 4.2–4.7, 4.13, 4.16, 4.18)

Dispatchers and Local Admins have no profile table of their own; their extra data is their work.

### Time clock and face-to-face (V1) — add (042)
- `time_entries`: add `profile_id uuid null references profiles(id)` — whose clock entry.
- `face_to_face_sessions`: add `profile_id uuid null references profiles(id)`.
- `face_to_face_conversations`: add `cards_handed integer not null default 0`.

### `partnerships` (V1) — add (042)
`lat double precision, lng double precision, starred boolean not null default false, next_action_kind_id uuid null references list_items(id), next_action_at timestamptz null, next_action_note text`.
V1's `last_contact` stays and is set by a trigger from the newest `activities` row (canvas 4.2.3).

### New field-sales tables (042)
| table | purpose | columns |
|---|---|---|
| `contacts` | people at (or outside) partnerships | id, partnership_id null → partnerships, name, role_id → list_items, job_title, phone, email, source_id → list_items, email_opt_out bool default false, last_emailed_at, notes |
| `activities` | the activity trail: every call, text, email, visit, note | id, kind check in ('call','text','email','visit','note','stage_change'), occurred_at timestamptz, outcome text, note, partnership_id → partnerships, contact_id null → contacts, cards_dropped int default 0, cards_found int null, created_by → profiles |
| `placements` | card stacks left at a partnership | id, partnership_id → partnerships, location_note, placed_on date, removed_on date null |
| `placement_refills` | each time cards are added to a placement | id, placement_id → placements, activity_id null → activities, cards_added int, cards_still_there int null, refilled_on date |
| `card_collections` | cards picked up from the printer | id, collected_on date, quantity int, from_whom text, note |
| `card_counts` | physical stock counts | id, counted_on date, real_count int, ledger_count int, correction int generated always as (real_count - ledger_count) stored, counted_by → profiles |
| `visit_days` | a day's walking route | id, visit_date date unique, start_address text, route_sorted bool default false |
| `visit_stops` | stops on a visit day | id, visit_day_id → visit_days, partnership_id → partnerships, due_time time null, position int |

View `v2_card_ledger` (045): collections − (visit drops + face-to-face hand-outs + refills) ± count corrections.

### `report_definitions` — NEW (044)
**Purpose:** reports the Local Admin builds and who can see them (canvas 4.18).
`id uuid pk, name text, blocks jsonb not null default '[]'` (ordered: measure, chart or table, filters), `visible_roles text[] default '{}', visible_profile_ids uuid[] default '{}', created_by, updated_at`.

---

## 7. SHARED — jobs and everything on a job (canvas 4.1, 2.1, 2.2)

### `jobs` (V1) — add columns (039)
**Status:** widen the check to a superset:
`Inquiry, Assigning, Queued, Quoted, Booked, On the way, Working, Completed, Cancelled, Lost, Rejected`.
⚠ Browser app: before V2 writes the new statuses, add them to `JOB_STATUSES` in `src/lib/types.ts` (the job form only
offers that list, and `JobForm.tsx` treats anything other than Inquiry/Quoted as "booked or later").

| group | new columns (type) | purpose / canvas |
|---|---|---|
| payer | `customer_email text` | name, phone, type already exist (4.1.2) |
| on-site | `onsite_same_as_payer boolean not null default true`, `onsite_name text`, `onsite_phone text` | 4.1.2, 2.1.8 |
| customer link | `customer_profile_id uuid null → profiles`, `customer_linked_by uuid null → profiles`, `customer_linked_at timestamptz`, `customer_linked_via text check in ('admin','phone_verified','email_verified')` | 4.9.4, 2.10 |
| owner | `owner_dispatcher_id uuid null → profiles` | 2.12 |
| title | `title text null` | short job title workers see, e.g. "Jane's Couch!" |
| ending | `ending_reason_id uuid null → list_items`, `ending_note text` | 4.1.1 |
| service | `customer_description text`, `category_answers jsonb not null default '{}'` | `notes` = internal, `details` = site text (both V1, kept) (4.1.3) |
| quote | `quote_type text check in ('fixed','estimate')`, `quote_fixed_total numeric(12,2)`, `quote_hourly_rate numeric(12,2)`, `quote_min_hours numeric(5,2)`, `quote_est_hours numeric(5,2)`, `quote_sent_at timestamptz`, `quote_accepted_at timestamptz` | 2.1.7 |
| site | `site_parking text`, `site_access text`, `site_rules text`, `site_flags jsonb not null default '{}'` (large/fragile, gate code, do-not-touch…) | 4.1.10 |
| schedule | `confirmed_arrival_end_time time null` — set = the confirmed arrival is a window | 2.1.6 |
| dispatch | `seats_needed int not null default 1 check (seats_needed between 1 and 10)`, `is_vendor_job boolean not null default false`, `vendor_entity_id uuid null → entities`, `queued_at timestamptz` | 4.1.5 |
| next action | `next_action_kind_id uuid null → list_items`, `next_action_note text`. **Time = existing `follow_up_at`** (the browser app's Calls Today already reads it) | 2.11 |
| snapshot | `commission_percent_snapshot`, `flat_fee_snapshot`, `transfer_fee_snapshot`, `deposit_fee_snapshot` (numeric null; filled on insert from `settings` by trigger) | 4.1.7 |

Kept as-is from V1: `job_id` (JOB-0012…), `confirmed_arrival_date` (= the job's one date), `estimated_duration_minutes`,
`total_invoice_paid`, `pos_fee_percent`, `total_worker_payout_override`, `invoice_ref`, `google_calendar_event_id`,
`completed_at`, `job_arrival_windows` (windows offered to the customer).

### Tables that hang off a job (040)
| table | purpose | columns |
|---|---|---|
| `job_stops` | the job's addresses in order (4.1.4) | id, job_id → jobs on delete cascade, position int, address text, lat, lng — unique (job_id, position). A trigger rewrites V1's `jobs.addresses text[]` from these so the browser app still sees the stops. |
| `job_needs` | what the job needs: equipment, vehicle, skills (4.1.5) | id, job_id → jobs on delete cascade, kind check in ('equipment','vehicle','skill'), list_item_id null → list_items, item_name text, quantity int default 1 |
| `job_pool` | the workers to offer the job to, in order (2.2.1) | id, job_id → jobs on delete cascade, entity_id → entities, position int — unique (job_id, entity_id) |
| `job_offers` | every offer, take and timeout (2.2.1) | id, job_id → jobs on delete cascade, entity_id → entities, position int, offered_at timestamptz, expires_at timestamptz, outcome text check in ('waiting','offered','taken','timed_out','skipped'), responded_at timestamptz |
| `job_slides` | every slide a crew member makes, with its time (2.1.4) | id, job_worker_id → job_workers on delete cascade, kind check in ('online','arrive','leave','complete'), stop_position int null, occurred_at timestamptz (the phone's time; kept when offline), recorded_at timestamptz default now() |
| `job_photos` | photos taken on the job (4.1.9) | id, job_id → jobs on delete cascade, job_worker_id null → job_workers, stop_position int null, kind check in ('before','stop','after','damage','other'), storage_path text, taken_at timestamptz |
| `job_events` | customer requests and Something's up (4.1.8) | id, job_id → jobs on delete cascade, kind check in ('change_request','cancel_request','problem','running_late','cant_get_in','job_bigger','damage','give_back'), body text, raised_by → profiles, raised_at, resolved_by null, resolved_at null |
| `worker_locations` | live position while working (4.14) | job_worker_id uuid pk → job_workers on delete cascade, lat, lng, updated_at — written only between online and complete; deleted on complete |

### `job_workers` (V1) — add (040)
**Purpose (V1):** the crew — one row per seat, linking a job to a worker entity.
Add: `is_point_of_contact boolean not null default false`, `assigned_via text null check in ('offer','queue','manual','vendor')`,
`assigned_at timestamptz`, `released_at timestamptz null` ("I can't make it"), `be_online_by timestamptz null`,
`hours_corrected_by uuid null → profiles`, `hours_corrected_at timestamptz null`.
V1's hours/rates columns stay; V2 fills them from slides and the dispatcher corrects them.

### Customer payment (041)
`customer_payments` **purpose:** the Square invoice linked to a job and its status, set by hand for now (4.10.2, 2.5.2).
`id uuid pk, job_id uuid not null → jobs on delete cascade, square_link text, status text not null default 'unpaid' check in ('unpaid','partly_paid','paid','refunded','cancelled'), amount_invoiced numeric(12,2), amount_paid numeric(12,2), tip numeric(12,2), amount_refunded numeric(12,2), due_on date, set_by uuid → profiles, set_at timestamptz, square_invoice_id text null, last_synced_at timestamptz null`.
Overdue is derived (`status not in ('paid','refunded','cancelled') and due_on < current_date`), never stored.
V1's `jobs.total_invoice_paid` still drives commission in the browser app.

### Other job records (043)
| table | purpose | columns |
|---|---|---|
| `job_checklist_items` | the texts the dispatcher must send at each stage (2.6.2) | id, job_id → jobs on delete cascade, line_key text, due_at timestamptz, done_at timestamptz null, done_by null → profiles — unique (job_id, line_key) |
| `job_signoffs` | the "how was everything?" answers (2.6.2) | id, job_id unique → jobs, damage boolean, notes text, recorded_by → profiles, recorded_at |
| `job_worker_scores` | the customer's rating of each crew member | id, job_worker_id unique → job_workers, score int check (score between 1 and 10) |
| `message_log` | tap-to-text sends: which template, who, when — **never the words** (4.1.8) | id, job_id null → jobs, partnership_id null → partnerships, template_id null → message_templates, sender_id → profiles, recipient_kind text check in ('customer','worker','dispatcher','partnership'), sent_at timestamptz default now() |
| `job_status_events` (044) | every status change with its time (2.1.1) | id, job_id → jobs on delete cascade, from_status text, to_status text, changed_by uuid, changed_at timestamptz — filled by trigger |

`line_key` values: `inquiry_received, request_info, quote_sent, quote_follow_up, crew_confirmed, day_before, on_the_way, still_looking, job_changed, cancelled_lost, payment_due, sign_off`.

---

## 8. WORKER MONEY (canvas 4.10.1, 4.11) — (041)

| table | purpose | columns |
|---|---|---|
| `job_expenses` | a worker's expense on a job, receipt required | id, job_worker_id → job_workers on delete cascade, description text, amount numeric(12,2), receipt_path text not null, added_at |
| `payouts` | whether a crew member's pay for a job has been sent | id, job_worker_id unique → job_workers, computed_amount numeric(12,2) (snapshot when marked sent), status text not null default 'pending' check in ('pending','sent'), method text, sent_on date, reference text, marked_by → profiles, marked_at |
| `payout_corrections` | a payout that wasn't sent or went out at a different amount; never edits the original | id, payout_id → payouts, kind check in ('not_sent','different_amount'), real_amount numeric(12,2) null, note text, corrected_by → profiles, corrected_at |
| `worker_tax_years` | 1099 status per worker per year | id, entity_id → entities, tax_year int, filed_on date null, document_path text, note — unique (entity_id, tax_year) |

The payout override stays **`job_workers.total_pay_override`** (V1) — one override column, not two.
Year-to-date paid and "threshold crossed" come from a view over `payouts`; "W-9 on file" from `entity_documents`.

---

## 9. SETTINGS & LISTS (canvas 4.12) — (036)

### `list_items` (V1) — widen `kind` check
Keep the existing kinds and add `job_ending_reason`, `next_action_kind`, `contact_role`, `contact_source`, `skill`.
`partnership_status` stays the partnership **stage** list. Add columns:
`default_cards integer null` (face-to-face outcome default cards), `ending_group text null check in ('Cancelled','Lost','Rejected')`.

### `settings` (V1, single row) — add columns
| column | type / default | canvas |
|---|---|---|
| flat_company_fee | numeric(12,2) default 5.00 | 4.12.2 (the V1 view hard-codes 5.0 — leave it; the V2 view reads this) |
| dispatch_wait_seconds | integer default 60 | 2.2.1 |
| crew_cap | integer default 10 | 2.2.3 |
| default_refill_interval_days | integer default 30 | 4.12.2 |
| next_action_gaps | text[] default `'{1 hour,1 day,3 days,1 week}'` | 4.12.2 |
| quote_follow_up_hours | integer default 24 | 2.6.2 |
| day_before_reminder_time | time default '17:00' | 2.6.2 |
| rating_threshold | numeric(4,2) default 8 | 4.12.6 |
| expiring_soon_days | integer default 30 | 2.7.1 |
| contact_reveal_minutes | integer default 60 | customer details shown 1 h before arrival (5.2.3) |

### `category_questions` — NEW
**Purpose:** the questions each service category asks (canvas 4.12.5). Answers go in `jobs.category_answers`.
`id uuid pk, service_category_id uuid not null → list_items, label text, answer_type text check in ('text','checkbox','number','choice'), choices text[] default '{}', required boolean default false, sort_order int default 0, archived boolean default false`

### `fee_catalog` — NEW
**Purpose:** named fees the Local Admin edits; they pre-load onto jobs (canvas 4.12.4).
`id uuid pk, name text, default_amount numeric(12,2), shape text check in ('flat','per_hour','percent_of_payout'), lands_on text check in ('payout','invoice','both'), counts_for_commission boolean default true, default_category_ids uuid[] default '{}', sort_order int, archived boolean default false`.
`job_worker_fees` (V1): add `fee_catalog_id uuid null`, `shape text null`, `lands_on text null`. The job keeps fees as applied.

`message_templates` (V1): add `kind text null` (the checklist line it serves). Staff templates only — worker templates are `worker_templates` (§4).
`equipment_presets` (V1): unchanged.

---

## 10. Who sees what (RLS) — canvas 5.5 — (046)

| tables | Customer | Worker | Dispatcher | Local Admin |
|---|---|---|---|---|
| `profiles` | own row | own row | read all | all |
| `customer_details` | own row (no `notes`) | — | all | all |
| `signed_agreements` | own: insert + read | own: insert + read | read | all |
| `agreement_texts` | read current customer text | read current IC text | read | write |
| `entities`, `entity_rates/fees/equipment/references` | — | own entity (via view) | all | all |
| `entity_documents` | — | own: insert + read | read | all |
| `entity_unavailability`, `worker_templates` | — | own: all | read | all |
| jobs and job_* (base tables) | — (via `v_customer_jobs`) | — (via `v_worker_jobs`) | all | all |
| `job_slides`, `job_photos`, `job_expenses`, `job_events` | own job: photos read, events insert | own rows insert + read | all | all |
| `job_offers` | — | own offers | all | all |
| `customer_payments` | own jobs (via view) | — | all | all |
| `payouts`, `payout_corrections`, `worker_tax_years` | — | own, after completion (view) | — | all |
| `rating_events` | — | own score only (view) | read | all |
| field sales tables (§6) | — | — | all (some via `has_module`) | all |
| `settings`, `list_items`, `category_questions`, `fee_catalog` | read lists & questions | read lists | read | write |
| `rating_rules`, `module_grants`, `report_definitions` | — | — | read | write |
| `push_tokens` | own | own | own | own |
| `notification_log` | own (read) | own (read) | all | all |
| `message_log` | — | — | all | all |
| `audit_log`, `job_status_events` | — | — | read | read |

### Views and RPCs (045)
| name | purpose |
|---|---|
| `v_worker_jobs` | jobs offered to or crewed by `my_entity_id()`; customer name, phone and stop addresses are null until `contact_reveal_minutes` before arrival; no invoice, commission or other workers' pay |
| `v_customer_jobs` | jobs where `customer_profile_id = auth.uid()`; plain-word status (canvas 2.1.1), crew first name / photo / vehicle, Square link and status; never payout or commission |
| `v_work_queue` | next actions across jobs (`follow_up_at`) and partnerships (`next_action_at`), plus due checklist lines, in time order |
| `v2_dispatchable_entities` | workers who may get offers (§4) |
| `v2_entity_rating` | current rating per worker from `rating_events` |
| `v2_job_worker_payout` | V1 `job_worker_pay` + expenses + catalog fees by shape |
| `v2_job_financials` | like `job_financials`, reading `settings.flat_company_fee` and the job's snapshots |
| `v2_payouts_owed`, `v2_worker_ytd` | Local Admin payout and 1099 screens |
| `v2_card_ledger` | card stock (§6) |
| `take_offer(p_job uuid)` RPC | locks the job row, checks a seat is free, inserts `job_workers`, marks the offer taken; returns `taken` or `already_gone` |
| `hours_from_slides(p_job_worker uuid)` RPC | regular / travel hours from slides in 15-minute steps |
| `match_jobs_for_contact`, `link_jobs_to_account` RPCs | §3 |

All views `security_invoker = on`.

### Edit history — `audit_log` (044)
**Purpose:** every change to key fields: who, when, old value, new value (canvas 4.1.11).
`id uuid pk, table_name text, row_id uuid, column_name text, old_value text, new_value text, changed_by uuid, changed_at timestamptz default now()`
— trigger on `jobs`, `job_workers`, `entity_rates`, `payouts`, `customer_payments`, `settings`.

---

## 11. Storage buckets (047)
| bucket | holds | who can read |
|---|---|---|
| `job-photos` | `job_photos.storage_path` | staff; crew on that job; the job's customer |
| `receipts` | `job_expenses.receipt_path` | staff; the worker who added it |
| `documents` | `entity_documents.storage_path`, `worker_tax_years.document_path` | Local Admin; the owning worker |
| `entity-photos` | `entities.photo_path` | any signed-in user |

---

## 12. Open decisions that touch this map (canvas 6.2.1)
- Tips in Square → worker payout untouched by commission? (decides how `customer_payments.tip` feeds `v2_job_worker_payout`)
- First-sign-in password change (`profiles.must_change_password`, proposed yes for admin-created accounts)
- Default cascade order (zone, then rating — proposed); what happens below a rating of 8
- Workers editing their own rates (RLS follows Local Admin only for now)

None of them block migrations 034–046.
