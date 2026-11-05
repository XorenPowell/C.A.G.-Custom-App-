"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import {
  addAction,
  completeScheduledAction,
  deleteScheduledAction,
} from "@/app/actions/scheduled";
import { TIME_STEP_SECONDS, chicagoLocalToUTCISO } from "@/lib/dates";
import { todayLocal } from "@/lib/follow-up";
import { ACTIVITY_META } from "@/lib/activity-meta";
import { FOLLOW_UP_KINDS, FOLLOW_UP_LABELS, type FollowUpKind } from "@/lib/types";
import type { ScheduledAction } from "@/lib/scheduled";

/**
 * The plan, sitting above the history in the same column.
 *
 * Rendered with an open ring rather than a filled dot: these have not
 * happened yet, and the distinction has to survive a glance. The earliest
 * one is what the work queue shows, which is said plainly rather than left
 * to be inferred.
 */
export default function PlannedActions({
  partnershipId,
  jobId,
  actions,
}: {
  partnershipId?: string;
  jobId?: string;
  actions: ScheduledAction[];
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<FollowUpKind>("call");
  const [local, setLocal] = useState(() => nowLocal());
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");

  function nowLocal() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Which half of the record this will land in, decided by the date alone.
  const isFuture = local ? new Date(local).getTime() > Date.now() : false;

  function plusDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
  }

  const parent = partnershipId ? { partnership_id: partnershipId } : { job_id: jobId };
  const today = todayLocal();

  function add() {
    if (!local) {
      setError("Pick a date first.");
      return;
    }
    start(async () => {
      setError(null);
      const res = await addAction({
        ...parent,
        kind,
        at: chicagoLocalToUTCISO(local),
        note: note || null,
        outcome: outcome || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not add.");
        return;
      }
      setAdding(false);
      setKind("call");
      setLocal(nowLocal());
      setNote("");
      setOutcome("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteScheduledAction(id);
      if (!res.ok) setError(res.error ?? "Could not delete.");
      router.refresh();
    });
  }

  function done(a: ScheduledAction) {
    start(async () => {
      const res = await completeScheduledAction(a.id, `${FOLLOW_UP_LABELS[a.kind].noun} done`);
      if (!res.ok) setError(res.error ?? "Could not complete.");
      router.refresh();
    });
  }

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label mb-0">Planned ({actions.length})</span>
        {!adding && (
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
            + Add action
          </button>
        )}
      </div>

      {actions.length === 0 && !adding && (
        <p className="muted text-sm">
          Nothing planned. <b>Add action</b> logs something that already happened or
          books one for later — the date decides which. The earliest planned one is what
          shows in your work queue.
        </p>
      )}

      <ol className="m-0 list-none p-0">
        {actions.map((a, i) => {
          const day = a.due_at.slice(0, 10);
          const overdue = dayOf(a.due_at) < today;
          const meta = ACTIVITY_META[a.kind] ?? ACTIVITY_META.note;
          return (
            <li key={a.id} className="flex gap-3 py-2">
              {/* Open ring: planned, not done. */}
              <span
                aria-hidden
                className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 bg-transparent"
                style={{ borderColor: overdue ? "var(--color-danger)" : meta.tone }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">
                    {FOLLOW_UP_LABELS[a.kind].noun}
                    {a.note ? ` — ${a.note}` : ""}
                  </span>
                  <span
                    className={`mono text-xs ${overdue ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}
                  >
                    {new Date(a.due_at).toLocaleDateString("en-US", {
                      timeZone: "America/Chicago",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {new Date(a.due_at).toLocaleTimeString("en-US", {
                      timeZone: "America/Chicago",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {i === 0 && (
                    <span className="badge border-[var(--color-accent)] text-[10px] text-[var(--color-accent)]">
                      IN QUEUE
                    </span>
                  )}
                  {overdue && (
                    <span className="badge border-[var(--color-danger)] text-[10px] text-[var(--color-danger)]">
                      OVERDUE
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => done(a)}
                    className="text-xs text-[var(--color-good)] underline underline-offset-2"
                  >
                    mark done
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(a.id)}
                    className="text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-danger)]"
                  >
                    delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {adding && (
        <div className="mt-2 border border-[var(--color-accent)] p-3">
          <div className="field">
            <span className="label">What kind</span>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [&>*]:shrink-0">
              {FOLLOW_UP_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`}
                  onClick={() => setKind(k)}
                >
                  {FOLLOW_UP_LABELS[k].noun}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-form">
            <div className="field">
              <label className="label" htmlFor="pa-when">
                When
              </label>
              <input
                id="pa-when"
                type="datetime-local" step={TIME_STEP_SECONDS}
                className="input"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="pa-note">
                {isFuture ? "What for" : "Notes"}
              </label>
              <input
                id="pa-note"
                className="input"
                value={note}
                placeholder={isFuture ? "Drop the new fliers" : "Asked about the vacant unit"}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {!isFuture && (
            <div className="field">
              <label className="label" htmlFor="pa-outcome">
                Outcome
              </label>
              <input
                id="pa-outcome"
                className="input"
                value={outcome}
                placeholder="Spoke with the manager"
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>
          )}

          <p className={`note ${isFuture ? "" : "border-[var(--color-good)]"}`}>
            {isFuture
              ? "In the future, so this is booked as a plan and can appear in your work queue."
              : "In the past, so this is logged straight to the history below. Nothing gets scheduled."}
          </p>

          <div className="mb-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setLocal(plusDays(-7))}>
              Last week
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setLocal(plusDays(-1))}>
              Yesterday
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setLocal(nowLocal())}>
              Now
            </button>
            {[1, 3, 7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                className="btn btn-sm"
                onClick={() => setLocal(plusDays(d))}
              >
                {d === 1 ? "Tomorrow" : `+${d}d`}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={add}>
              {pending ? "Saving…" : isFuture ? "Add to plan" : "Log it"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 border border-[var(--color-danger)] px-2 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Chicago calendar day of an instant, for the overdue comparison. */
function dayOf(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
