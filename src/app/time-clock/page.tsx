import TopBar from "@/components/TopBar";
import ClockButton from "@/components/ClockButton";
import TimeEntryRow from "@/components/TimeEntryRow";
import { getActiveEntry, getEntries, entryMinutes } from "@/lib/time-clock";
import { chicagoDateOf, inRange, resolveRange } from "@/lib/dates";
import { dateLongDisplay, durationDisplay } from "@/lib/format";
import type { TimeEntry } from "@/lib/types";

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
                  <TimeEntryRow key={e.id} entry={e} />
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
