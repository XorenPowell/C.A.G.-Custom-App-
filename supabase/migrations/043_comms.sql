-- =====================================================================
-- 043 — messages, checklists and sign-off
-- The checklist of texts due at each stage of a job, the log of every text
-- sent (who, when, which template, never the words), push-notification
-- tokens, the notification log, and the sign-off answers and the customer's
-- scores for each crew member. Safe to re-run.
-- =====================================================================

-- ---------- job_checklist_items ---------------------------------------
create table if not exists job_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  line_key    text not null check (line_key in (
                'inquiry_received','request_info','quote_sent','quote_follow_up',
                'crew_confirmed','day_before','on_the_way','still_looking',
                'job_changed','cancelled_lost','payment_due','sign_off')),
  due_at      timestamptz,
  done_at     timestamptz,
  done_by     uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (job_id, line_key)
);
comment on table job_checklist_items is 'The texts the dispatcher must send at each stage of a job, with when each is due and when it was done.';
alter table job_checklist_items enable row level security;
drop policy if exists job_checklist_items_staff_all on job_checklist_items;
create policy job_checklist_items_staff_all on job_checklist_items
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- message_log -----------------------------------------------
-- Records that a message was sent. The words themselves are never stored.
create table if not exists message_log (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references jobs(id) on delete set null,
  partnership_id  uuid references partnerships(id) on delete set null,
  template_id     uuid references message_templates(id) on delete set null,
  sender_id       uuid references profiles(id) on delete set null,
  recipient_kind  text not null check (recipient_kind in ('customer','worker','dispatcher','partnership')),
  sent_at         timestamptz not null default now()
);
comment on table message_log is 'Each tap-to-text send: which template, to whom, by whom, when. The text of the message is never stored here.';
create index if not exists message_log_job_idx on message_log (job_id, sent_at);
alter table message_log enable row level security;
drop policy if exists message_log_staff_all on message_log;
create policy message_log_staff_all on message_log
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- push_tokens -----------------------------------------------
create table if not exists push_tokens (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  expo_push_token  text not null unique,
  platform         text,
  updated_at       timestamptz not null default now()
);
comment on table push_tokens is 'Where to send push notifications: one row per device per account.';
alter table push_tokens enable row level security;
drop policy if exists push_tokens_own on push_tokens;
create policy push_tokens_own on push_tokens
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------- notification_log -----------------------------------------
create table if not exists notification_log (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  channel       text not null check (channel in ('push','email')),
  job_id        uuid references jobs(id) on delete set null,
  content_ref   text,
  sent_at       timestamptz not null default now(),
  status        text not null default 'sent' check (status in ('sent','failed','read'))
);
comment on table notification_log is 'Every push or email sent to an account, and whether it arrived or was read. content_ref points at the message, never the words.';
create index if not exists notification_log_recipient_idx on notification_log (recipient_id, sent_at);
alter table notification_log enable row level security;
drop policy if exists notification_log_staff_all on notification_log;
create policy notification_log_staff_all on notification_log
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists notification_log_own_read on notification_log;
create policy notification_log_own_read on notification_log
  for select to authenticated using (recipient_id = auth.uid());

-- ---------- job_signoffs ----------------------------------------------
create table if not exists job_signoffs (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null unique references jobs(id) on delete cascade,
  damage       boolean not null default false,
  notes        text,
  recorded_by  uuid references profiles(id) on delete set null,
  recorded_at  timestamptz not null default now()
);
comment on table job_signoffs is 'The "how was everything?" answers taken when a job closes: whether there was damage, and any notes. One per job.';
alter table job_signoffs enable row level security;
drop policy if exists job_signoffs_staff_all on job_signoffs;
create policy job_signoffs_staff_all on job_signoffs
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- job_worker_scores -----------------------------------------
create table if not exists job_worker_scores (
  id             uuid primary key default gen_random_uuid(),
  job_worker_id  uuid not null unique references job_workers(id) on delete cascade,
  score          integer not null check (score between 1 and 10),
  created_at     timestamptz not null default now()
);
comment on table job_worker_scores is 'The customer''s score for each crew member on a job, 1 to 10. Feeds the rating through rating_events.';
alter table job_worker_scores enable row level security;
drop policy if exists job_worker_scores_staff_all on job_worker_scores;
create policy job_worker_scores_staff_all on job_worker_scores
  for all to authenticated using (is_staff()) with check (is_staff());
