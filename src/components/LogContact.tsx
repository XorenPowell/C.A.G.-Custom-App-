"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { logContact } from "@/app/actions/activity";
import { ACTIVITY_KINDS } from "@/lib/types";
import { OUTCOME_SUGGESTIONS } from "@/lib/activity-meta";
import { chicagoDateTimeInputValue, chicagoLocalToUTCISO } from "@/lib/dates";
import type { ActivityKind } from "@/lib/types";

const KIND_LABEL: Record<ActivityKind, string> = {
  call: "Call", text: "Text", email: "Email",
  visit: "Visit", restock: "Restock", note: "Note",
};

/**
 * Log what happened and book what happens next, in one step.
 *
 * The next-callback half is pre-filled with a sensible date rather than left
 * blank, because the failure mode being designed out is finishing a call and
 * scheduling nothing.
 */
export default function LogContact({
  partnershipId,
  jobId,
  currentFollowUpAt,
  currentFollowUpNote,
  defaultKind = "call",
  compact = false,
}: {
  partnershipId?: string;
  jobId?: string;
  currentFollowUpAt: string | null;
  currentFollowUpNote: string | null;
  defaultKind?: ActivityKind;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<ActivityKind>(defaultKind);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [scheduleNext, setScheduleNext] = useState(true);
  const [nextLocal, setNextLocal] = useState(() => plusDays(7));
  const [nextNote, setNextNote] = useState(currentFollowUpNote ?? "");

  function plusDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
  }

  function reset() {
    setKind(defaultKind);
    setOutcome("");
    setNote("");
    setScheduleNext(true);
    setNextLocal(plusDays(7));
    setNextNote(currentFollowUpNote ?? "");
    setError(null);
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await logContact({
        partnership_id: partnershipId ?? null,
        job_id: jobId ?? null,
        kind,
        outcome: outcome || null,
        note: note || null,
        // Scheduling off means "there is deliberately nothing next", which
        // has to clear the existing callback rather than leave it stale.
        next_follow_up_at: scheduleNext && nextLocal ? chicagoLocalToUTCISO(nextLocal) : null,
        next_follow_up_note: scheduleNext ? nextNote || null : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`btn btn-primary ${compact ? "btn-sm" : ""}`}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Log contact
      </button>
    );
  }

  return (
    <section className="card mb-3 border-[var(--color-accent)]">
      <div className="section-title flex items-center justify-between">
        <span>Log contact</span>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <div className="card-pad">
        <div className="field">
          <span className="label">What happened</span>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [&>*]:shrink-0">
            {ACTIVITY_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="lc-outcome">
            Outcome
          </label>
          <input
            id="lc-outcome"
            className="input"
            value={outcome}
            placeholder="Spoke with POC"
            onChange={(e) => setOutcome(e.target.value)}
          />
          {OUTCOME_SUGGESTIONS[kind].length > 0 && (
            <div className="mt-1 -mx-1 flex gap-1 overflow-x-auto px-1 [&>*]:shrink-0">
              {OUTCOME_SUGGESTIONS[kind].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setOutcome(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="lc-note">
            Notes
          </label>
          <textarea
            id="lc-note"
            className="textarea"
            value={note}
            placeholder="Prefers mornings. Asked for a quote on the vacant unit."
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="border-t border-[var(--color-line)] pt-3">
          <label className="mb-2 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={scheduleNext}
              onChange={(e) => setScheduleNext(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-semibold">Schedule the next contact</span>
          </label>

          {scheduleNext ? (
            <>
              <div className="grid-form">
                <div className="field">
                  <label className="label" htmlFor="lc-next">
                    Call back on
                  </label>
                  <input
                    id="lc-next"
                    type="datetime-local"
                    className="input"
                    value={nextLocal}
                    onChange={(e) => setNextLocal(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="lc-next-note">
                    What for
                  </label>
                  <input
                    id="lc-next-note"
                    className="input"
                    value={nextNote}
                    placeholder="Check if they placed the cards"
                    onChange={(e) => setNextNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setNextLocal(plusDays(d))}
                  >
                    {d === 1 ? "Tomorrow" : `+${d}d`}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-warn)]">
              Nothing will be scheduled, and any existing callback is cleared. This record
              drops out of every follow-up list.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 border border-[var(--color-danger)] px-2 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>

        {currentFollowUpAt && scheduleNext && (
          <p className="muted mt-2 text-xs">
            Replaces the callback currently booked for{" "}
            {chicagoDateTimeInputValue(currentFollowUpAt).replace("T", " ")}.
          </p>
        )}
      </div>
    </section>
  );
}
