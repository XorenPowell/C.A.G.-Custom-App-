"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { setNextAction } from "@/app/actions/activity";
import { chicagoDateTimeInputValue, chicagoLocalToUTCISO } from "@/lib/dates";

type Tone = "overdue" | "today" | "upcoming" | "none";

const BADGE: Record<Tone, string> = {
  overdue: "border-[var(--color-danger)] text-[var(--color-danger)]",
  today: "border-[var(--color-warn)] text-[var(--color-warn)]",
  upcoming: "border-[var(--color-line)] text-[var(--color-muted)]",
  none: "border-[var(--color-danger)] text-[var(--color-danger)]",
};

/**
 * The callback, editable where it is read.
 *
 * Booking the next contact is the most frequent edit on the screen, so it
 * does not sit behind the Edit form. Date and time are split because a
 * datetime-local control is awkward on a phone.
 */
export default function NextActionCard({
  partnershipId,
  jobId,
  followUpAt,
  followUpNote,
  tone,
  dueLabel,
  /**
   * What the badge reads when nothing is booked, and whether that state is
   * worth alarming about. A finished job with no callback is the correct end
   * state; an open one is a leak.
   */
  emptyLabel = "nothing booked",
  alarmWhenEmpty = true,
  children,
}: {
  partnershipId?: string;
  jobId?: string;
  followUpAt: string | null;
  followUpNote: string | null;
  tone: Tone;
  dueLabel: string;
  emptyLabel?: string;
  alarmWhenEmpty?: boolean;
  children?: React.ReactNode;
}) {
  const alarming = tone === "none" && alarmWhenEmpty;
  const router = useRouter();
  const [pending, start] = useGlobalTransition();

  const initial = followUpAt ? chicagoDateTimeInputValue(followUpAt) : "";
  const [date, setDate] = useState(initial ? initial.slice(0, 10) : "");
  const [time, setTime] = useState(initial ? initial.slice(11, 16) : "09:00");
  const [note, setNote] = useState(followUpNote ?? "");
  const [saved, setSaved] = useState(false);

  const dirty =
    (date ? `${date}T${time || "09:00"}` : "") !== initial || note !== (followUpNote ?? "");

  function save(nextDate = date, nextTime = time, nextNote = note) {
    start(async () => {
      const iso = nextDate ? chicagoLocalToUTCISO(`${nextDate}T${nextTime || "09:00"}`) : null;
      await setNextAction(
        partnershipId ? { partnership_id: partnershipId } : { job_id: jobId },
        iso,
        nextNote,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    });
  }

  /** Quick-set writes immediately: one tap should be the whole interaction. */
  function inDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    const next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setDate(next);
    setTime("09:00");
    save(next, "09:00", note);
  }

  return (
    <section
      className={`card ${
        alarming
          ? "border-[var(--color-danger)]"
          : tone === "none"
            ? ""
            : "border-[var(--color-accent)]"
      }`}
    >
      <div className="section-title flex items-center justify-between gap-2">
        <span>Next action</span>
        <span
          className={`badge ${
            tone === "none"
              ? alarming
                ? BADGE.none
                : BADGE.upcoming
              : BADGE[tone]
          }`}
        >
          {tone === "none" ? emptyLabel : dueLabel}
        </span>
      </div>

      <div className="card-pad">
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="na-date">Call back on</label>
            <input
              id="na-date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => dirty && save()}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="na-time">At</label>
            <input
              id="na-time"
              type="time"
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => dirty && save()}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="na-note">What for</label>
          <input
            id="na-note"
            className="input"
            value={note}
            placeholder="Ask about the Q1 referral push"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => dirty && save()}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => inDays(1)}>
            Tomorrow
          </button>
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => inDays(3)}>
            +3 days
          </button>
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => inDays(7)}>
            +1 week
          </button>
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => inDays(30)}>
            +1 month
          </button>
          {date && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={pending}
              onClick={() => {
                setDate("");
                save("", time, note);
              }}
            >
              Clear
            </button>
          )}
          <span className="self-center text-xs text-[var(--color-muted)]">
            {pending ? "saving…" : saved ? "saved" : dirty ? "unsaved" : ""}
          </span>
        </div>

        {children}
      </div>
    </section>
  );
}
