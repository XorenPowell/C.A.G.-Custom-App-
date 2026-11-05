"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { setNextAction } from "@/app/actions/activity";
import { TIME_STEP_SECONDS, chicagoDateTimeInputValue, chicagoLocalToUTCISO } from "@/lib/dates";
import { FOLLOW_UP_KINDS, FOLLOW_UP_LABELS, type FollowUpKind } from "@/lib/types";

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
  followUpKind,
  tone,
  dueLabel,
  /**
   * What the badge reads when nothing is booked, and whether that state is
   * worth alarming about. A finished job with no callback is the correct end
   * state; an open one is a leak.
   */
  emptyLabel = "nothing booked",
  alarmWhenEmpty = true,
  /** Zone of this record, and the next date already being walked there. */
  zoneName,
  nextZoneDay,
  children,
}: {
  partnershipId?: string;
  jobId?: string;
  followUpAt: string | null;
  followUpNote: string | null;
  followUpKind: FollowUpKind;
  tone: Tone;
  dueLabel: string;
  emptyLabel?: string;
  alarmWhenEmpty?: boolean;
  zoneName?: string | null;
  nextZoneDay?: string | null;
  children?: React.ReactNode;
}) {
  const alarming = tone === "none" && alarmWhenEmpty;
  const router = useRouter();
  const [pending, start] = useGlobalTransition();

  const initial = followUpAt ? chicagoDateTimeInputValue(followUpAt) : "";
  const [date, setDate] = useState(initial ? initial.slice(0, 10) : "");
  const [time, setTime] = useState(initial ? initial.slice(11, 16) : "09:00");
  const [note, setNote] = useState(followUpNote ?? "");
  const [kind, setKind] = useState<FollowUpKind>(followUpKind ?? "call");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    (date ? `${date}T${time || "09:00"}` : "") !== initial ||
    note !== (followUpNote ?? "") ||
    kind !== (followUpKind ?? "call");

  function save(nextDate = date, nextTime = time, nextNote = note, nextKind = kind) {
    start(async () => {
      setError(null);
      const iso = nextDate ? chicagoLocalToUTCISO(`${nextDate}T${nextTime || "09:00"}`) : null;
      const res = await setNextAction(
        partnershipId ? { partnership_id: partnershipId } : { job_id: jobId },
        iso,
        nextNote,
        nextKind,
      );
      // The result used to be discarded, so a failed write left the card
      // showing "unsaved" with no explanation and the edit quietly lost.
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
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
    save(next, "09:00", note, kind);
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
        <div className="field">
          <span className="label">What kind</span>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [&>*]:shrink-0">
            {FOLLOW_UP_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`}
                onClick={() => {
                  setKind(k);
                  if (date) save(date, time, note, k);
                }}
              >
                {FOLLOW_UP_LABELS[k].noun}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="na-date">{FOLLOW_UP_LABELS[kind].when}</label>
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
              type="time" step={TIME_STEP_SECONDS}
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
          {/* Booking a visit is really choosing which run it joins, so the
              useful date is "when am I next in that neighbourhood". */}
          {kind === "visit" && nextZoneDay && nextZoneDay !== date && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={pending}
              onClick={() => {
                setDate(nextZoneDay);
                save(nextZoneDay, time, note, kind);
              }}
            >
              Next {zoneName ?? "zone"} day
            </button>
          )}
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
          {dirty && !pending && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => save()}>
              Save next action
            </button>
          )}
          <span className="self-center text-xs text-[var(--color-muted)]">
            {pending ? "saving…" : saved ? "saved" : dirty ? "unsaved" : ""}
          </span>
        </div>

        {error && (
          <p className="mt-2 border border-[var(--color-danger)] px-2 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        {kind === "visit" && zoneName && (
          <p className="muted mt-2 text-xs">
            {nextZoneDay
              ? `You are next in ${zoneName} on ${nextZoneDay}.`
              : `Nothing else booked in ${zoneName} yet — this starts the run.`}
          </p>
        )}

        {children}
      </div>
    </section>
  );
}
