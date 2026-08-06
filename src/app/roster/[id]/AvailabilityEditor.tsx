"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAvailability, type AvailabilityBlock } from "@/app/actions/entities";
import { todayISO } from "@/lib/dates";
import { daysSince, isAvailabilityStale } from "@/lib/format";
import type { EntityAvailability } from "@/lib/types";

/** YYYY-MM-DD from local date parts, never routed through UTC. */
function localISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date arithmetic on the string itself, so no timezone can shift the day. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Availability lives on the entity page rather than the main form so it can be
 * updated in a few taps, and so a profile edit never resets the staleness clock.
 */
export default function AvailabilityEditor({
  entityId,
  blocks,
  note,
  updatedAt,
}: {
  entityId: string;
  blocks: EntityAvailability[];
  note: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AvailabilityBlock[]>(
    [...blocks]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({
        date: b.date.slice(0, 10),
        start_time: b.start_time?.slice(0, 5) ?? "",
        end_time: b.end_time?.slice(0, 5) ?? "",
      })),
  );
  const [noteText, setNoteText] = useState(note ?? "");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stale = isAvailabilityStale(updatedAt);
  const age = daysSince(updatedAt);

  function addDay(offset: number) {
    // Built from local date parts. toISOString() would roll over to tomorrow
    // any evening after 7pm Chicago time, because it converts to UTC first.
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = localISO(d);
    if (rows.some((r) => r.date === iso)) return;
    setRows((prev) => [...prev, { date: iso, start_time: "", end_time: "" }]);
    setStatus(null);
  }

  /**
   * Copies a block's times onto the next day that has no block yet. Holding
   * down Duplicate walks a week forward without retyping the hours, which is
   * the common case — the same shift repeated across several days.
   */
  function duplicate(index: number) {
    setRows((prev) => {
      const source = prev[index];
      if (!source.date) return prev;

      const taken = new Set(prev.map((r) => r.date));
      let next = source.date;
      for (let i = 0; i < 366; i++) {
        next = addDaysISO(next, 1);
        if (!taken.has(next)) break;
      }

      const copy: AvailabilityBlock = { ...source, date: next };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
    setStatus(null);
  }

  function patch(index: number, next: Partial<AvailabilityBlock>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
    setStatus(null);
  }

  function save() {
    start(async () => {
      setError(null);
      setStatus(null);
      const res = await saveAvailability(entityId, rows, noteText);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      setStatus("Availability updated.");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {stale ? (
          <span className="badge border-[var(--color-danger)] bg-red-50 text-[var(--color-danger)]">
            ⚑ {age === null ? "Never set" : `${age} days old`}
          </span>
        ) : (
          <span className="badge border-[var(--color-good)] text-[var(--color-good)]">
            Updated {age === 0 ? "today" : `${age}d ago`}
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <button type="button" className="btn btn-sm" onClick={() => addDay(0)}>
          + Today
        </button>
        <button type="button" className="btn btn-sm" onClick={() => addDay(1)}>
          + Tomorrow
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() =>
            setRows((prev) => [...prev, { date: todayISO(), start_time: "", end_time: "" }])
          }
        >
          + Block
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => {
              setRows([]);
              setStatus(null);
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {rows.map((r, i) => (
        <div key={i} className="mb-1 flex flex-wrap items-center gap-1">
          <input
            type="date"
            className="input w-auto flex-1"
            value={r.date}
            onChange={(e) => patch(i, { date: e.target.value })}
          />
          <input
            type="time"
            className="input w-auto"
            value={r.start_time ?? ""}
            onChange={(e) => patch(i, { start_time: e.target.value })}
          />
          <span className="muted text-sm">–</span>
          <input
            type="time"
            className="input w-auto"
            value={r.end_time ?? ""}
            onChange={(e) => patch(i, { end_time: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => duplicate(i)}
            title="Copy these times to the next day that has no block yet"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            title="Remove this block"
            aria-label="Remove this block"
          >
            ✕
          </button>
        </div>
      ))}

      {rows.length > 0 && (
        <p className="muted mb-2 text-xs">
          Duplicate copies a block&apos;s hours onto the next open day — tap it repeatedly
          to fill out a week.
        </p>
      )}

      {rows.length === 0 && (
        <p className="muted mb-2 text-sm">No availability blocks set.</p>
      )}

      <textarea
        className="textarea mt-2 min-h-16"
        placeholder="Availability note (free-form)"
        value={noteText}
        onChange={(e) => {
          setNoteText(e.target.value);
          setStatus(null);
        }}
      />

      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save availability"}
        </button>
        {status && <span className="text-sm text-[var(--color-good)]">{status}</span>}
        {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
      </div>
    </div>
  );
}
