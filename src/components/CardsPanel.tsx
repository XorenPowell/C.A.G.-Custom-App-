"use client";

import { useState } from "react";
import { dateDisplay } from "@/lib/format";

export type CardsSummary = {
  /** Every card ever left here, summed from the visits themselves. */
  total: number;
  lastVisit: string | null;
  lastDrop: number | null;
  lastFound: number | null;
  visits: number;
  /** Cards taken per week, or null when there is not enough history. */
  perWeek: number | null;
  /**
   * "counted" when the last visit recorded what was still on the stack;
   * "assumed" when it did not, and an empty stack had to be assumed.
   */
  basis: "counted" | "assumed" | null;
};

/**
 * What this business has had, and how fast it goes.
 *
 * Replaces the Visits & Collateral fields on the edit form. Those were
 * typed in and went stale the moment a visit was logged anywhere else;
 * everything here is summed from the visits, so it cannot disagree with
 * the trail below it.
 */
export default function CardsPanel({ summary }: { summary: CardsSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card mb-3">
      <div className="section-title">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <span aria-hidden className="text-[var(--color-muted)]">{open ? "▾" : "▸"}</span>
          <span>Cards</span>
          <span className="muted ml-auto text-xs normal-case">
            {summary.total.toLocaleString()} dropped
            {summary.perWeek != null && ` · ~${summary.perWeek}/week taken`}
          </span>
        </button>
      </div>

      {open && (
        <div className="card-pad">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Figure label="Total dropped" value={summary.total.toLocaleString()}
              hint={`over ${summary.visits} visit${summary.visits === 1 ? "" : "s"}`} />
            <Figure label="Last visit" value={summary.lastVisit ? dateDisplay(summary.lastVisit) : "—"}
              hint={summary.lastDrop != null ? `${summary.lastDrop} dropped` : "no count recorded"} />
            <Figure label="Still there" value={summary.lastFound != null ? String(summary.lastFound) : "—"}
              hint="at the last visit" />
            <Figure
              label="Taken per week"
              value={summary.perWeek != null ? String(summary.perWeek) : "—"}
              hint={
                summary.basis === "counted"
                  ? "from the count on arrival"
                  : summary.basis === "assumed"
                    ? "assuming the stack emptied"
                    : "needs two visits"
              }
            />
          </div>

          <p className="note mt-3">
            {summary.basis === "assumed" ? (
              <>
                No count was recorded on arrival, so this assumes the whole previous drop
                was taken. Fill in <strong>Cards still there</strong> on the next visit and
                the estimate stops guessing.
              </>
            ) : summary.basis === "counted" ? (
              <>
                Measured from what was actually left on the stack: the previous drop minus
                what was still there, over the days between.
              </>
            ) : (
              <>
                Two visits with card counts are needed before a rate can be worked out.
                Log the cards dropped each visit and this fills itself in.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="font-heading text-xl font-extrabold">{value}</div>
      {hint && <div className="text-xs text-[var(--text-faint)]">{hint}</div>}
    </div>
  );
}
