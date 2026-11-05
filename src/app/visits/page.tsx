import TopBar from "@/components/TopBar";
import { getVisitDays } from "@/lib/visits";
import { todayISO } from "@/lib/dates";
import VisitDays from "./VisitDays";

export default async function VisitsPage() {
  const days = await getVisitDays();
  const today = todayISO();

  const upcoming = days.filter((d) => !d.overdue);
  const overdue = days.filter((d) => d.overdue);
  const stops = days.reduce((n, d) => n + d.stops.length, 0);
  const restocks = days.reduce(
    (n, d) => n + d.stops.filter((s) => s.source === "restock").length,
    0,
  );

  return (
    <>
      <TopBar title="Visits" back={null} />
      <main className="page max-w-4xl">
        <p className="muted mb-3 text-sm">
          {stops} stop{stops === 1 ? "" : "s"} across {days.length} day
          {days.length === 1 ? "" : "s"}
          {restocks > 0 && ` · ${restocks} restock${restocks === 1 ? "" : "s"} folded in`}.
          Expand a day to re-time its stops; saving re-orders them.
        </p>

        {overdue.length > 0 && (
          <>
            <span className="label">Overdue</span>
            <div className="mb-4">
              <VisitDays days={overdue} today={today} />
            </div>
            <span className="label">Coming up</span>
          </>
        )}

        <VisitDays days={upcoming} today={today} />

        <p className="muted mt-4 text-xs">
          A restock appears on the day it falls due and has no time until you add it to a
          run. A business with a booked visit does not list its restock separately —
          you will be standing there anyway.
        </p>
      </main>
    </>
  );
}
