import Link from "next/link";
import { getDashboard } from "@/lib/dashboard";
import { getBookedToday, getWorkQueue } from "@/lib/home";
import WorkQueue from "@/components/WorkQueue";
import { getLists, getSettings, lookup, nameMap } from "@/lib/data";
import { getUser } from "@/lib/supabase/server";
import { payPeriodRange } from "@/lib/dates";
import { money, timeDisplay } from "@/lib/format";


/** One number and its state. The mockup's tiles, using the app's own tokens. */
function QueueTile({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: number;
  sub: string;
  alert: boolean;
}) {
  return (
    <div className="card card-pad">
      <div className="label">{label}</div>
      <div
        className={`font-heading text-[27px] font-extrabold leading-tight ${
          alert ? "text-[var(--color-danger)]" : ""
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-[var(--text-faint)]">{sub}</div>
    </div>
  );
}

export default async function HomePage() {
  const [lists, settings, user] = await Promise.all([getLists(), getSettings(), getUser()]);
  const names = nameMap(lists);

  const [bookedToday, queue] = await Promise.all([getBookedToday(), getWorkQueue()]);

  // Next payout survives the cull because it is a fixed weekly cycle, not a
  // range the Reports screen can show without being reconfigured each time.
  const payPeriod = payPeriodRange(settings.pay_period_start_day ?? 5);
  const payoutData = await getDashboard(payPeriod, names);

  const firstName = (user?.email ?? "there").split("@")[0].split(/[._-]/)[0];
  const todayLabel = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* ---------- greeting ---------- */}
      <section
        className="px-4 py-5 text-white"
        style={{ background: "linear-gradient(155deg, var(--hero-a), var(--hero-b), var(--hero-c))" }}
      >
        <div className="mx-auto max-w-6xl">
          <h1 className="font-heading text-2xl font-bold md:text-3xl">
            Welcome, {firstName}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
            <span>{todayLabel}</span>
            <span>
              Next payout:{" "}
              <span className="font-heading font-semibold text-white">
                {money(payoutData.totalCommission)}
              </span>
            </span>
            <Link href="/reports" className="text-white/90 underline underline-offset-2">
              Reports
            </Link>
          </p>
        </div>
      </section>

      {/* ---------- booked today: full-bleed, always today, ignores the range above ---------- */}
      <section className="mt-4 border-y border-[var(--border)] bg-[var(--panel)] py-4">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--live)] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[var(--live)]" />
            </span>
            <h2 className="font-heading flex-1 text-sm font-semibold uppercase tracking-wide">
              Booked Today
            </h2>
            <span className="badge border-[var(--pill-border)] bg-[var(--pill-bg)] text-[var(--text)]">
              {bookedToday.length}
            </span>
          </div>

          {bookedToday.length === 0 ? (
            <p className="muted text-sm">No jobs booked for today yet.</p>
          ) : (
            <div className="scroll-x flex gap-3 pb-1">
              {bookedToday.map((t) => (
                <Link
                  key={t.id}
                  href={`/jobs/${t.id}`}
                  className="flex w-64 shrink-0 flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel-raised)] p-3"
                >
                  <div>
                    <div className="font-heading text-lg font-semibold">
                      {t.arrival_time ? timeDisplay(t.arrival_time) : "No time set"}
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {lookup(names, t.service_category_id)}
                    </div>
                    <div className="mt-1 truncate text-sm text-[var(--text-faint)]">
                      {t.address || "No address"}
                    </div>
                  </div>
                  <div className="mt-2 flex h-10 items-center border-t border-dashed border-[var(--ticket-divider)] text-sm font-medium">
                    {t.entityNames.length ? t.entityNames.join(", ") : "Unassigned"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- work queue: partnerships, jobs and restocks ---------- */}
      <section className="mx-auto mt-4 max-w-6xl px-4">
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <QueueTile
            label="Calls due"
            value={queue.calls.length}
            sub={
              queue.calls.filter((c) => c.state === "overdue").length
                ? `${queue.calls.filter((c) => c.state === "overdue").length} overdue`
                : "on track"
            }
            alert={queue.calls.some((c) => c.state === "overdue")}
          />
          <QueueTile
            label="Restocks due"
            value={queue.restocks.length}
            sub="SAFC stacks"
            alert={queue.restocks.some((r) => r.state === "overdue")}
          />
          <QueueTile label="Booked today" value={bookedToday.length} sub="arrivals" alert={false} />
          <QueueTile
            label="No next action"
            value={queue.noAction.length}
            sub="nothing scheduled"
            alert={queue.noAction.length > 0}
          />
        </div>

        <WorkQueue calls={queue.calls} restocks={queue.restocks} noAction={queue.noAction} />
      </section>

</>
  );
}
