import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Google Calendar sync (spec section 7).
 *
 * Isolated on purpose: every exported entry point catches its own errors and
 * returns a warning string. Nothing in here ever throws into a job save, so a
 * Calendar outage can never stop the dispatcher from working.
 *
 * All calls happen server-side. The refresh token lives in `google_credentials`,
 * which has no RLS policy for signed-in sessions — only the service role can
 * read it, so it can never reach the browser.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const API = "https://www.googleapis.com/calendar/v3";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/** The business is Chicago-based; arrival times are entered as local wall time. */
export const TIME_ZONE = "America/Chicago";

export type CalendarOutcome = { warning: string | null };
const OK: CalendarOutcome = { warning: null };

export type GoogleCredentials = {
  refresh_token: string | null;
  access_token: string | null;
  expires_at: string | null;
  calendar_id: string;
  updated_at: string | null;
};

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/google/callback`
  );
}

export function consentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline", // required to receive a refresh token
    prompt: "consent", // force a refresh token even on re-authorisation
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function getCredentials(): Promise<GoogleCredentials | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("google_credentials")
    .select("refresh_token, access_token, expires_at, calendar_id, updated_at")
    .eq("id", true)
    .single();
  return (data as GoogleCredentials) ?? null;
}

export async function isConnected(): Promise<boolean> {
  const creds = await getCredentials();
  return !!creds?.refresh_token;
}

/** Exchanges the one-time code for a refresh token and stores it. */
export async function exchangeCode(code: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });

    const json = (await res.json()) as {
      refresh_token?: string;
      access_token?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    };

    if (!res.ok) {
      return { error: json.error_description ?? json.error ?? "Token exchange failed." };
    }
    if (!json.refresh_token) {
      return {
        error:
          "Google did not return a refresh token. Remove the app's access at myaccount.google.com/permissions and connect again.",
      };
    }

    const db = createAdminClient();
    await db
      .from("google_credentials")
      .update({
        refresh_token: json.refresh_token,
        access_token: json.access_token ?? null,
        expires_at: json.expires_in
          ? new Date(Date.now() + json.expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Token exchange failed." };
  }
}

export async function disconnect(): Promise<void> {
  const db = createAdminClient();
  await db
    .from("google_credentials")
    .update({
      refresh_token: null,
      access_token: null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
}

/** Returns a valid access token, refreshing it when it is close to expiry. */
async function accessToken(): Promise<string | null> {
  const creds = await getCredentials();
  if (!creds?.refresh_token) return null;

  const stillValid =
    creds.access_token &&
    creds.expires_at &&
    new Date(creds.expires_at).getTime() - Date.now() > 60_000;

  if (stillValid) return creds.access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: creds.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  const db = createAdminClient();
  await db
    .from("google_credentials")
    .update({
      access_token: json.access_token,
      expires_at: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
    })
    .eq("id", true);

  return json.access_token;
}

type JobForCalendar = {
  id: string;
  job_id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  estimated_duration_minutes: number | null;
  addresses: string[];
  notes: string | null;
  google_calendar_event_id: string | null;
  service_category: string | null;
  entities: { entity_name: string; poc_name: string | null; poc_phone: string | null }[];
};

function buildEvent(job: JobForCalendar) {
  const start = `${job.arrival_date}T${(job.arrival_time ?? "09:00").slice(0, 5)}:00`;
  const startMs = new Date(`${start}Z`).getTime();
  const durationMin = job.estimated_duration_minutes ?? 60;
  const end = new Date(startMs + durationMin * 60_000).toISOString().slice(0, 19);

  const description = [
    job.addresses.length ? `Stops:\n${job.addresses.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}` : null,
    job.entities.length
      ? `Assigned: ${job.entities.map((e) => e.entity_name).join(", ")}`
      : null,
    job.entities
      .filter((e) => e.poc_phone)
      .map((e) => `POC ${e.poc_name ?? e.entity_name}: ${e.poc_phone}`)
      .join("\n") || null,
    job.customer_phone ? `Customer: ${job.customer_name ?? ""} ${job.customer_phone}`.trim() : null,
    job.notes ? `Notes:\n${job.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    summary: `${job.service_category ?? "Job"} — ${job.customer_name ?? "Customer"} (${job.job_id})`,
    location: job.addresses[0] ?? undefined,
    description,
    start: { dateTime: start, timeZone: TIME_ZONE },
    end: { dateTime: end, timeZone: TIME_ZONE },
  };
}

async function loadJob(jobId: string): Promise<JobForCalendar | null> {
  const db = createAdminClient();

  const { data: job } = await db
    .from("jobs")
    .select(
      "id, job_id, status, customer_name, customer_phone, arrival_date, arrival_time, estimated_duration_minutes, addresses, notes, google_calendar_event_id, service_category_id",
    )
    .eq("id", jobId)
    .single();

  if (!job) return null;

  const [{ data: category }, { data: workers }] = await Promise.all([
    job.service_category_id
      ? db.from("list_items").select("name").eq("id", job.service_category_id).single()
      : Promise.resolve({ data: null }),
    db.from("job_workers").select("entities(entity_name, poc_name, poc_phone)").eq("job_id", jobId),
  ]);

  return {
    ...job,
    service_category: (category as { name: string } | null)?.name ?? null,
    entities: ((workers ?? []) as unknown as {
      entities: { entity_name: string; poc_name: string | null; poc_phone: string | null } | null;
    }[])
      .map((w) => w.entities)
      .filter(Boolean) as JobForCalendar["entities"],
  } as JobForCalendar;
}

async function storeEventId(jobId: string, eventId: string | null): Promise<void> {
  const db = createAdminClient();
  await db.from("jobs").update({ google_calendar_event_id: eventId }).eq("id", jobId);
}

/**
 * Reconciles the calendar with the job's current state.
 *
 *   Booked              -> create the event, or patch the existing one
 *   Cancelled / Lost    -> delete the event and clear the stored id
 *   anything else       -> leave whatever is there alone
 *
 * Deriving the action from current state rather than a status transition means
 * an edit to the date, time, duration or address while Booked patches the event
 * without the caller having to track what changed.
 */
export async function syncJobCalendar(jobId: string): Promise<CalendarOutcome> {
  try {
    if (!googleConfigured()) return OK;

    const creds = await getCredentials();
    if (!creds?.refresh_token) return OK; // never connected — nothing to do

    const job = await loadJob(jobId);
    if (!job) return OK;

    const token = await accessToken();
    if (!token) {
      return {
        warning:
          "Job saved, but the Google Calendar connection needs re-authorising in Settings.",
      };
    }

    const calendarId = encodeURIComponent(creds.calendar_id || "primary");
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    if (job.status === "Cancelled" || job.status === "Lost") {
      if (!job.google_calendar_event_id) return OK;

      const res = await fetch(
        `${API}/calendars/${calendarId}/events/${encodeURIComponent(job.google_calendar_event_id)}`,
        { method: "DELETE", headers },
      );
      // 410 means it was already gone, which is the state we wanted anyway.
      if (res.ok || res.status === 404 || res.status === 410) {
        await storeEventId(jobId, null);
        return OK;
      }
      return { warning: "Job saved, but the calendar event could not be removed." };
    }

    if (job.status !== "Booked") return OK;

    if (!job.arrival_date) {
      return {
        warning: "Job saved. No calendar event was created because there is no arrival date.",
      };
    }

    const body = JSON.stringify(buildEvent(job));

    if (job.google_calendar_event_id) {
      const res = await fetch(
        `${API}/calendars/${calendarId}/events/${encodeURIComponent(job.google_calendar_event_id)}`,
        { method: "PATCH", headers, body },
      );
      if (res.ok) return OK;

      // The event was deleted in Google; fall through and make a fresh one.
      if (res.status === 404 || res.status === 410) {
        await storeEventId(jobId, null);
      } else {
        return { warning: "Job saved, but the calendar event could not be updated." };
      }
    }

    const res = await fetch(`${API}/calendars/${calendarId}/events`, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      return { warning: "Job saved, but the calendar event could not be created." };
    }

    const created = (await res.json()) as { id?: string };
    if (created.id) await storeEventId(jobId, created.id);
    return OK;
  } catch {
    return { warning: "Job saved. Google Calendar did not respond." };
  }
}
