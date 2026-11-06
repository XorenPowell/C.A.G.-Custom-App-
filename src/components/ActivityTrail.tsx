"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { deleteActivity, updateActivity } from "@/app/actions/activity";
import { ACTIVITY_META, OUTCOME_SUGGESTIONS } from "@/lib/activity-meta";
import { TIME_STEP_SECONDS, chicagoDateTimeInputValue, chicagoLocalToUTCISO } from "@/lib/dates";
import type { Activity } from "@/lib/types";

/** The contact history. Replaces a single overwritable last_contact date. */
export default function ActivityTrail({
  entries,
  emptyHint,
}: {
  entries: Activity[];
  emptyHint: string;
}) {
  const [showAll, setShowAll] = useState(false);

  if (entries.length === 0) {
    return <p className="muted text-sm">{emptyHint}</p>;
  }

  const visible = showAll ? entries : entries.slice(0, 8);

  return (
    <>
      <ol className="m-0 list-none p-0">
        {visible.map((a) => (
          <TrailEntry key={a.id} entry={a} />
        ))}
      </ol>

      {entries.length > 8 && (
        <button type="button" className="btn btn-sm mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
    </>
  );
}

/**
 * One logged contact, correctable in place.
 *
 * Entries get written mid-call, so the wrong time and a half-typed note are
 * the normal case rather than the exception. Double-click opens the editor —
 * the gesture asked for — and an `edit` link sits beside `delete` so the
 * ability is visible, and reachable from the keyboard.
 */
function TrailEntry({ entry }: { entry: Activity }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState(() => chicagoDateTimeInputValue(entry.occurred_at));
  const [outcome, setOutcome] = useState(entry.outcome ?? "");
  const [note, setNote] = useState(entry.note ?? "");

  const meta = ACTIVITY_META[entry.kind] ?? ACTIVITY_META.note;
  const occurred = new Date(entry.occurred_at);

  /** Re-reads the entry each time, so a cancelled edit never leaks forward. */
  function open() {
    setWhen(chicagoDateTimeInputValue(entry.occurred_at));
    setOutcome(entry.outcome ?? "");
    setNote(entry.note ?? "");
    setError(null);
    setEditing(true);
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await updateActivity(entry.id, {
        occurred_at: when ? chicagoLocalToUTCISO(when) : undefined,
        outcome: outcome.trim() || null,
        note: note.trim() || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this log entry?")) return;
    start(async () => {
      const res = await deleteActivity(entry.id);
      if (!res.ok) {
        setError(res.error ?? "Could not delete.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex gap-3 border-b border-[var(--color-line-soft)] py-2.5 last:border-b-0">
      <span
        aria-hidden
        className="mt-1.5 size-2.5 shrink-0 rounded-full"
        style={{ background: meta.tone }}
      />

      {editing ? (
        <div
          className="min-w-0 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
        >
          <div className="grid-form">
            <div className="field">
              <label className="label" htmlFor={`act-when-${entry.id}`}>
                When it happened
              </label>
              <input
                id={`act-when-${entry.id}`}
                type="datetime-local"
                step={TIME_STEP_SECONDS}
                className="input"
                value={when}
                autoFocus
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor={`act-outcome-${entry.id}`}>
                Outcome
              </label>
              <input
                id={`act-outcome-${entry.id}`}
                className="input"
                value={outcome}
                placeholder={meta.label}
                onChange={(e) => setOutcome(e.target.value)}
              />
              {OUTCOME_SUGGESTIONS[entry.kind]?.length > 0 && (
                <div className="-mx-1 mt-1 flex gap-1 overflow-x-auto px-1 [&>*]:shrink-0">
                  {OUTCOME_SUGGESTIONS[entry.kind].map((s) => (
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
          </div>

          <div className="field">
            <label className="label" htmlFor={`act-note-${entry.id}`}>
              Notes
            </label>
            <textarea
              id={`act-note-${entry.id}`}
              className="textarea"
              rows={3}
              value={note}
              placeholder="What was said, what they asked for."
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <p className="mb-2 border border-[var(--color-danger)] px-2 py-1.5 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1" title="Double-click to edit" onDoubleClick={open}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{entry.outcome || meta.label}</span>
            <span className="muted mono shrink-0 text-right text-xs">
              {occurred.toLocaleDateString("en-US", {
                timeZone: "America/Chicago",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              <span className="block">
                {occurred.toLocaleTimeString("en-US", {
                  timeZone: "America/Chicago",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2" onDoubleClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-[var(--color-muted)]">{meta.label}</span>
            <button
              type="button"
              disabled={pending}
              onClick={open}
              className="text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-danger)]"
            >
              delete
            </button>
          </div>

          {entry.note && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
              {entry.note}
            </p>
          )}
          {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      )}
    </li>
  );
}
