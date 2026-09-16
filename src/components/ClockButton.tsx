"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clockIn, clockOut } from "@/app/actions/time-clock";
import SessionTimer from "@/components/SessionTimer";
import type { TimeEntry } from "@/lib/types";

export default function ClockButton({ activeEntry }: { activeEntry: TimeEntry | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<null | "confirm-in" | "confirm-out" | "notes">(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setMode(null);
    setError(null);
  }

  function submitClockIn() {
    start(async () => {
      setError(null);
      const res = await clockIn();
      if (!res.ok) {
        setError(res.error ?? "Could not clock in.");
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  function submitClockOut() {
    if (!activeEntry) return;
    start(async () => {
      setError(null);
      const res = await clockOut(activeEntry.id, notes);
      if (!res.ok) {
        setError(res.error ?? "Could not clock out.");
        return;
      }
      setMode(null);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <>
      {activeEntry ? (
        <div className="card card-pad mb-4 flex flex-col items-center gap-2 py-6">
          <SessionTimer startedAt={activeEntry.clocked_in_at} />
          <span className="muted text-sm">
            clocked in at{" "}
            {new Date(activeEntry.clocked_in_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <button
            type="button"
            className="btn btn-danger mt-2 w-full"
            onClick={() => setMode("confirm-out")}
          >
            Clock Out
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary mb-4 w-full"
          onClick={() => setMode("confirm-in")}
        >
          Clock In
        </button>
      )}

      {mode === "confirm-in" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-3">Clocking in for the day?</h2>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={close} disabled={pending}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={submitClockIn}
                disabled={pending}
              >
                {pending ? "Clocking in…" : "Yes, clock in"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "confirm-out" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-3">Ready to clock out?</h2>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={close} disabled={pending}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => setMode("notes")}
                disabled={pending}
              >
                Yes, clock out
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "notes" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-3">What did you accomplish?</h2>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}
            <textarea
              className="textarea mb-3"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summarize what got done during this period."
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={close} disabled={pending}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={submitClockOut}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save & clock out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
