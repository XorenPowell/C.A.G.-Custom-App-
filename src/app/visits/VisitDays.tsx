"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { addScheduledAction, updateScheduledAction, deleteScheduledAction } from "@/app/actions/scheduled";
import { chicagoLocalToUTCISO, TIME_STEP_SECONDS } from "@/lib/dates";
import type { VisitDay, VisitStop } from "@/lib/visits";

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
          {day.stops.map((stop) => (
            <StopRow key={stop.id} stop={stop} date={day.date} />
          ))}
        </div>
      )}
    </section>
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
