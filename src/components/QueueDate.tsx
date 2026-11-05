"use client";

import { useRouter } from "next/navigation";
import { useGlobalTransition } from "@/lib/useGlobalTransition";

/**
 * Which day the queue is measured against.
 *
 * Everything due on or before the chosen date is shown, so picking Friday
 * answers "what do I need to have done by Friday" rather than hiding today's
 * overdue work behind a future date.
 */
export default function QueueDate({ asOf, today }: { asOf: string; today: string }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();

  function go(date: string) {
    start(() => {
      router.push(date === today ? "/" : `/?due=${date}`);
      router.refresh();
    });
  }

  function shift(days: number) {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    go(dt.toISOString().slice(0, 10));
  }

  const isToday = asOf === today;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="label mb-0">Due through</span>

      <button
        type="button"
        disabled={pending}
        onClick={() => go(today)}
        className={`btn btn-sm ${isToday ? "btn-primary" : ""}`}
      >
        Today
      </button>
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => shift(1)}>
        Tomorrow
      </button>
      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => shift(7)}>
        This week
      </button>

      <input
        type="date"
        className="input w-auto"
        value={asOf}
        disabled={pending}
        aria-label="Show work due through this date"
        onChange={(e) => e.target.value && go(e.target.value)}
      />

      {!isToday && (
        <span className="text-xs text-[var(--color-warn)]">
          Showing everything due through {asOf}, overdue included.
        </span>
      )}
    </div>
  );
}
