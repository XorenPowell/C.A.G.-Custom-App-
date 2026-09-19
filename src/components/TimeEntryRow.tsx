"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { updateTimeEntry } from "@/app/actions/time-clock";
import { chicagoDateTimeInputValue } from "@/lib/dates";
import type { TimeEntry } from "@/lib/types";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

/** One clock-in/clock-out entry, editable in place — for fixing a mistaken timestamp after the fact. */
export default function TimeEntryRow({ entry }: { entry: TimeEntry }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [editing, setEditing] = useState(false);
  const [clockedIn, setClockedIn] = useState(chicagoDateTimeInputValue(entry.clocked_in_at));
  const [clockedOut, setClockedOut] = useState(
    entry.clocked_out_at ? chicagoDateTimeInputValue(entry.clocked_out_at) : "",
  );
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    start(async () => {
      setError(null);
      const res = await updateTimeEntry(entry.id, clockedIn, clockedOut || null, notes);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setClockedIn(chicagoDateTimeInputValue(entry.clocked_in_at));
    setClockedOut(entry.clocked_out_at ? chicagoDateTimeInputValue(entry.clocked_out_at) : "");
    setNotes(entry.notes ?? "");
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="border-t border-[var(--color-line)] pt-2 first:border-0 first:pt-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            {timeOf(entry.clocked_in_at)} –{" "}
            {entry.clocked_out_at ? timeOf(entry.clocked_out_at) : "In progress"}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        {entry.notes && <p className="muted mt-1 text-sm">{entry.notes}</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--color-line)] pt-2 first:border-0 first:pt-0">
      {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="grid-form">
        <div className="field">
          <label className="label">Clock in</label>
          <input
            type="datetime-local"
            className="input"
            value={clockedIn}
            onChange={(e) => setClockedIn(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Clock out</label>
          <input
            type="datetime-local"
            className="input"
            value={clockedOut}
            onChange={(e) => setClockedOut(e.target.value)}
          />
        </div>
      </div>
      <textarea
        className="textarea mt-2"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What got done during this period."
      />
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn flex-1" onClick={cancel} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
