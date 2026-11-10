"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import {
  addScheduledAction,
  updateScheduledAction,
  deleteScheduledAction,
} from "@/app/actions/scheduled";
import { sortVisitDayByRoute, clearVisitDayOrder } from "@/app/actions/visits";
import { mapsLegs } from "@/lib/maps";
import { chicagoLocalToUTCISO, TIME_STEP_SECONDS } from "@/lib/dates";
import type { VisitDay, VisitStop } from "@/lib/visits";

/** One start address per browser, not per day: it is usually the same place. */
const START_KEY = "visit-run-start";

/**
 * A day of walking, as a day of walking.
 *
 * Each row collapses to the thing worth knowing at a glance — the date, the
 * zone and how many stops — because the question being answered is "when am
 * I next in Uptown", not "what is every visit I have booked".
 */
export default function VisitDays({ days, today }: { days: VisitDay[]; today: string }) {
  const [open, setOpen] = useState<string | null>(days.find((d) => d.date >= today)?.date ?? null);

  if (days.length === 0) {
    return (
      <p className="muted card card-pad text-sm">
        No visits planned. Book one from a partnership and it lands on a day here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => (
        <DayRow
          key={day.date}
          day={day}
          today={today}
          expanded={open === day.date}
          onToggle={() => setOpen(open === day.date ? null : day.date)}
        />
      ))}
    </div>
  );
}

function DayRow({
  day,
  today,
  expanded,
  onToggle,
}: {
  day: VisitDay;
  today: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const isToday = day.date === today;

  return (
    <section className={`card ${day.overdue ? "border-[var(--color-danger)]" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left md:px-4"
      >
        <span aria-hidden className="text-[var(--color-muted)]">{expanded ? "▾" : "▸"}</span>

        <span className="font-heading w-28 shrink-0 font-semibold">
          {label}
          {isToday && <span className="ml-1 text-xs text-[var(--live)]">today</span>}
        </span>

        <span className="min-w-0 flex-1 truncate">
          {day.zones.map((z, i) => (
            <span key={z.name}>
              {i > 0 && <span className="muted"> · </span>}
              <span className={i === 0 ? "font-semibold" : "muted"}>{z.name}</span>
              {day.zones.length > 1 && <span className="muted text-xs"> {z.count}</span>}
            </span>
          ))}
        </span>

        <span
          className={`badge shrink-0 ${
            day.overdue
              ? "border-[var(--color-danger)] text-[var(--color-danger)]"
              : "border-[var(--color-line)] text-[var(--color-muted)]"
          }`}
        >
          {day.stops.length} visit{day.stops.length === 1 ? "" : "s"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-line)]">
          <DayTools day={day} />
          {day.stops.map((stop) => (
            <StopRow key={stop.id} stop={stop} date={day.date} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Where the day starts, and what that makes of the order.
 *
 * The start address lives here rather than in Settings because it is not
 * always the same place — some runs start from home, some from the last
 * job of the morning. It is remembered per browser so the common case
 * needs no typing.
 */
function DayTools({ day }: { day: VisitDay }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [from, setFrom] = useState("");

  useEffect(() => {
    try {
      setFrom(window.localStorage.getItem(START_KEY) ?? "");
    } catch {
      // Private windows throw. An empty box is a fine fallback.
    }
  }, []);

  const booked = day.stops.filter((s) => s.source === "scheduled");

  /**
   * Order the day by where the stops are, not by when they are.
   *
   * Everything lands at 9:00 when a run is booked, so there is no time to
   * sort by — the order is the whole point. Times are left alone.
   */
  function sortByRoute() {
    start(async () => {
      setError(null);
      setNotice(null);
      try {
        window.localStorage.setItem(START_KEY, from);
      } catch {
        // Not remembering it must not stop the sort.
      }
      const res = await sortVisitDayByRoute(booked.map((s) => s.id), from);
      if (!res.ok) {
        setError(res.error ?? "Could not sort.");
        return;
      }
      if (res.unplaced && res.unplaced.length > 0) {
        setNotice(
          `${res.unplaced.length} stop${res.unplaced.length === 1 ? "" : "s"} had no coordinates ` +
            `and stayed at the end: ${res.unplaced.join(", ")}`,
        );
      }
      router.refresh();
    });
  }

  function clearOrder() {
    start(async () => {
      setError(null);
      setNotice(null);
      const res = await clearVisitDayOrder(booked.map((s) => s.id));
      if (!res.ok) setError(res.error ?? "Could not clear.");
      router.refresh();
    });
  }

  const legs = mapsLegs(from, day.stops.map((s) => s.address));

  return (
    <div className="border-b border-[var(--color-line-soft)] px-3.5 py-2.5 md:px-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="field mb-0 min-w-0 flex-1 basis-56">
          <label className="label" htmlFor={`run-from-${day.date}`}>
            Starting from
          </label>
          <input
            id={`run-from-${day.date}`}
            className="input"
            value={from}
            placeholder="4700 N Racine Ave"
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={pending || booked.length < 2}
          onClick={sortByRoute}
        >
          {pending ? "Sorting…" : "Sort by route"}
        </button>

        {day.sorted && (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={clearOrder}>
            Clear order
          </button>
        )}

        {legs.map((leg) => (
          <a
            key={leg.href}
            className="btn btn-sm"
            href={leg.href}
            target="_blank"
            rel="noreferrer"
          >
            {legs.length === 1 ? "Open in Maps" : `Maps ${leg.from}–${leg.to}`}
          </a>
        ))}
      </div>

      <p className="muted mt-1.5 text-xs">
        {day.sorted
          ? "In walking order from the address above. Re-sort after adding a stop."
          : "Orders the stops so the day runs in one direction rather than back and forth."}
        {legs.length > 1 &&
          ` Maps takes nine stops to a link, so this run opens as ${legs.length} legs.`}
      </p>

      {notice && <p className="note mt-2 text-xs">{notice}</p>}
      {error && (
        <p className="mt-2 border border-[var(--color-danger)] px-2 py-1.5 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function StopRow({ stop, date }: { stop: VisitStop; date: string }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState(() => localTime(stop.due_at));

  function localTime(instant: string | null) {
    if (!instant) return "09:00";
    const s = new Date(instant).toLocaleTimeString("en-GB", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return s.slice(0, 5);
  }

  /** Saving re-sorts the day, because the server re-reads and re-orders. */
  function save() {
    start(async () => {
      const iso = chicagoLocalToUTCISO(`${date}T${time}`);
      if (stop.source === "scheduled") {
        await updateScheduledAction(stop.id, { due_at: iso });
      } else {
        // A restock has no booking of its own until it is given a time.
        await addScheduledAction({
          partnership_id: stop.partnership_id,
          kind: "visit",
          due_at: iso,
          note: stop.note,
        });
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (stop.source !== "scheduled") return;
    start(async () => {
      await deleteScheduledAction(stop.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line-soft)] px-3.5 py-2.5 last:border-b-0 md:px-4">
      {editing ? (
        <input
          type="time"
          step={TIME_STEP_SECONDS}
          className="input w-28 shrink-0"
          value={time}
          autoFocus
          onChange={(e) => setTime(e.target.value)}
          onBlur={save}
          aria-label={`Time for ${stop.business_name}`}
        />
      ) : (
        <span className="mono w-28 shrink-0 text-sm">
          {stop.due_at
            ? new Date(stop.due_at).toLocaleTimeString("en-US", {
                timeZone: "America/Chicago",
                hour: "numeric",
                minute: "2-digit",
              })
            : "—"}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <Link href={`/partnerships/${stop.partnership_id}`} className="link font-semibold">
          {stop.business_name}
        </Link>
        {stop.source === "restock" && (
          <span className="badge ml-2 border-[#a98bd8] text-[10px] text-[#c4acec]">RESTOCK</span>
        )}
        <span className="muted block truncate text-xs">
          {[stop.zone_name, stop.address, stop.note].filter(Boolean).join(" · ")}
        </span>
      </span>

      <span className="flex shrink-0 gap-1">
        <button
          type="button"
          className="btn btn-sm"
          disabled={pending}
          onClick={() => (editing ? save() : setEditing(true))}
        >
          {pending ? "…" : editing ? "Save" : stop.source === "restock" ? "Add to run" : "Edit"}
        </button>
        {stop.source === "scheduled" && (
          <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={remove}>
            ✕
          </button>
        )}
      </span>
    </div>
  );
}
