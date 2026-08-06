# C.A.G. Dispatch

Single-user internal dispatch application for Call A Guy Chicago. Replaces a set of
Google Sheets. Dispatcher-only — there is no customer-facing or worker-facing surface.

Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) · Vercel.
Google Calendar is the only external integration.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
```

`.env.local` holds the secrets and is gitignored. See `.env.local.example`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key — safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Reads `google_credentials`, which no signed-in session can touch |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Calendar OAuth client |
| `GOOGLE_REDIRECT_URI` | Must match the URI registered with Google exactly |
| `NEXT_PUBLIC_SITE_URL` | Deployed origin, used to build the OAuth redirect |

## Database

`supabase/schema.sql` is the whole schema and is safe to re-run — it drops and
recreates everything. `supabase/seed.sql` fills the Settings-driven lists.

Four domain tables (`entities`, `jobs`, `partnerships`, plus Settings), with child
tables for the repeating structures — rates, fees, equipment, references,
availability, job workers and worker fees — because those are genuine unbounded
lists, not fixed slots.

### Derived values

Nothing computed is ever stored. `job_worker_pay` and `job_financials` are views
that compute worker pay, POS fee, job costs, profit, week/month and the repeat
customer flag on read. `src/lib/calc.ts` mirrors those views exactly so the job
form can show live totals while editing — **if you change one, change both.**

The only editable derived values are `worker_total_pay` and `total_worker_payout`.
Each has a nullable override column; the override wins when present and every
downstream figure uses the effective value.

### Job numbering

`job_number_seq` starts at 12 because JOB-0001 through JOB-0011 exist historically.
`scripts/smoke-test.mjs` consumes numbers from that sequence — after running it,
reset with:

```sql
select setval('job_number_seq', (
  select coalesce(max(substring(job_id from 5)::int), 11) + 1 from jobs
), false);
```

## Scripts

Each takes the path to an env file as its only argument.

```bash
node scripts/check-db.mjs .env.local     # verify schema, seed and auth user
node scripts/seed-db.mjs  .env.local     # idempotent seed via the service role
node scripts/smoke-test.mjs .env.local   # end-to-end data test (burns job numbers)
```

## Conventions

- Every dropdown value comes from Settings. Never hardcode a service category,
  lead source, zone, vehicle type, tier or status in a component — read it from
  `getLists()`.
- Pure helpers live in `src/lib/lists.ts` and `src/lib/entity-filters.ts` so client
  components can share them. Anything importing `@/lib/supabase/server` is
  server-only and must never be pulled into a `"use client"` file.
- Every repeating structure has add and remove. Never a fixed number of slots.
- Autofilled values stay editable and never write back to their source.
- Availability has its own save path (`saveAvailability`) so editing a profile
  never resets the >6-day staleness flag.
- Google Calendar failures return a warning and never block a save.
