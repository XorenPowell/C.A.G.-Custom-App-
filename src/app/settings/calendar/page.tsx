import TopBar from "@/components/TopBar";
import { disconnectGoogle } from "@/app/actions/google";
import {
  getCredentials,
  googleConfigured,
  redirectUri,
  TIME_ZONE,
} from "@/lib/google-calendar";

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const configured = googleConfigured();
  const creds = configured ? await getCredentials() : null;
  const connected = !!creds?.refresh_token;

  return (
    <>
      <TopBar title="Google Calendar" back="/settings" backLabel="Settings" />
      <main className="page max-w-2xl">
        {sp.connected && (
          <p className="card card-pad mb-3 border-[var(--color-good)] text-sm text-[var(--color-good)]">
            Connected. Booked jobs will now sync to your calendar.
          </p>
        )}
        {sp.error && (
          <p className="card card-pad mb-3 border-[var(--color-danger)] text-sm text-[var(--color-danger)]">
            {sp.error === "not_configured"
              ? "Google credentials are not set on the server yet."
              : sp.error === "state_mismatch"
                ? "That authorisation attempt expired. Try connecting again."
                : sp.error}
          </p>
        )}

        <section className="card mb-3">
          <div className="section-title">Connection</div>
          <div className="card-pad">
            {!configured ? (
              <p className="text-sm">
                Not configured. <code className="mono">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="mono">GOOGLE_CLIENT_SECRET</code> need to be set as
                environment variables before this can be connected.
              </p>
            ) : connected ? (
              <>
                <p className="mb-3 text-sm">
                  <span className="badge border-[var(--color-good)] text-[var(--color-good)]">
                    Connected
                  </span>{" "}
                  {creds?.updated_at && (
                    <span className="muted">
                      since {new Date(creds.updated_at).toLocaleString()}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href="/api/google/start" className="btn">
                    Re-authorise
                  </a>
                  <form action={disconnectGoogle}>
                    <button type="submit" className="btn btn-danger">
                      Disconnect
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm">
                  Not connected. Authorise once and Booked jobs will appear on your
                  calendar automatically.
                </p>
                <a href="/api/google/start" className="btn btn-primary">
                  Connect Google Calendar
                </a>
              </>
            )}
          </div>
        </section>

        <section className="card mb-3">
          <div className="section-title">What syncs</div>
          <div className="card-pad text-sm">
            <ul className="ml-4 list-disc space-y-1">
              <li>
                A job moving to <strong>Booked</strong> creates an event.
              </li>
              <li>
                Editing the arrival date, time, duration or address of a Booked job
                updates that event.
              </li>
              <li>
                Moving a job to <strong>Cancelled</strong> or <strong>Lost</strong> deletes
                the event.
              </li>
              <li>
                Event title: <code className="mono">Service — Customer (JOB-0000)</code>,
                with all stops, assigned entities, POC and customer phones, and job notes
                in the description.
              </li>
              <li>Times are written in {TIME_ZONE}.</li>
            </ul>
            <p className="muted mt-3">
              If Google is unreachable the job still saves — you will see a warning on the
              save bar instead.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="section-title">Setup reference</div>
          <div className="card-pad text-sm">
            <p className="mb-1">
              Authorised redirect URI registered with Google must be exactly:
            </p>
            <code className="mono block break-all bg-[var(--color-sunken)] p-2">
              {redirectUri()}
            </code>
          </div>
        </section>
      </main>
    </>
  );
}
