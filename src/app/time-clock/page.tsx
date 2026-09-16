import TopBar from "@/components/TopBar";
import ClockButton from "@/components/ClockButton";
import { getActiveEntry, getEntries, entryMinutes } from "@/lib/time-clock";
import { chicagoDateOf, inRange, resolveRange } from "@/lib/dates";
import { dateLongDisplay, durationDisplay } from "@/lib/format";
import type { TimeEntry } from "@/lib/types";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export default async function TimeClockPage() {
  const [activeEntry, entries] = await Promise.all([getActiveEntry(), getEntries()]);

  const weekRange = resolveRange("This Week");
  const weekMinutes = entries
    .filter((e) => inRange(chicagoDateOf(e.clocked_in_at), weekRange))
    .reduce((sum, e) => sum + entryMinutes(e), 0);

  // Entries already arrive newest-first, so grouping by day preserves that
  // order both across days and within each day.
  const byDay = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const day = chicagoDateOf(e.clocked_in_at);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  return (
    <>
      <TopBar title="Clock In / Clock Out" back="/" backLabel="Home" />
      <main className="page max-w-2xl">
        <div className="card card-pad mb-4 text-center">
          <p className="muted text-sm">Total hours worked this week</p>
          <p className="text-3xl font-bold">{durationDisplay(weekMinutes)}</p>
        </div>

        <ClockButton activeEntry={activeEntry} />

        <div className="mt-2 flex flex-col gap-3">
          {[...byDay.entries()].map(([day, dayEntries]) => (
            <div key={day} className="card card-pad">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold">{dateLongDisplay(day)}</span>
                <span className="muted text-sm">
                  {durationDisplay(dayEntries.reduce((s, e) => s + entryMinutes(e), 0))}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {dayEntries.map((e) => (
                  <div
                    key={e.id}
                    className="border-t border-[var(--color-line)] pt-2 first:border-0 first:pt-0"
                  >
                    <div className="text-sm">
                      {timeOf(e.clocked_in_at)} –{" "}
                      {e.clocked_out_at ? timeOf(e.clocked_out_at) : "In progress"}
                    </div>
                    {e.notes && <p className="muted mt-1 text-sm">{e.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {byDay.size === 0 && (
            <p className="muted card card-pad text-sm">
              No work days logged yet — tap Clock In to start one.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
