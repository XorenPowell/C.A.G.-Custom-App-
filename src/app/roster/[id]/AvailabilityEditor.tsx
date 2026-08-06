"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAvailability, type AvailabilityBlock } from "@/app/actions/entities";
import { todayISO } from "@/lib/dates";
import { daysSince, isAvailabilityStale } from "@/lib/format";
import type { EntityAvailability } from "@/lib/types";

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
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    if (rows.some((r) => r.date === iso)) return;
    setRows((prev) => [...prev, { date: iso, start_time: "", end_time: "" }]);
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
            className="btn btn-sm btn-danger"
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}

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
