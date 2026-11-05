"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { deleteActivity } from "@/app/actions/activity";
import { ACTIVITY_META } from "@/lib/activity-meta";
import type { Activity } from "@/lib/types";

/** The contact history. Replaces a single overwritable last_contact date. */
export default function ActivityTrail({
  entries,
  emptyHint,
}: {
  entries: Activity[];
  emptyHint: string;
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [showAll, setShowAll] = useState(false);

  if (entries.length === 0) {
    return <p className="muted text-sm">{emptyHint}</p>;
  }

  const visible = showAll ? entries : entries.slice(0, 8);

  function remove(id: string) {
    if (!window.confirm("Delete this log entry?")) return;
    start(async () => {
      await deleteActivity(id);
      router.refresh();
    });
  }

  return (
    <>
      <ol className="m-0 list-none p-0">
        {visible.map((a) => {
          const meta = ACTIVITY_META[a.kind] ?? ACTIVITY_META.note;
          return (
            <li
              key={a.id}
              className="flex gap-3 border-b border-[var(--color-line-soft)] py-2.5 last:border-b-0"
            >
              <span
                aria-hidden
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ background: meta.tone }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {a.outcome || meta.label}
                  </span>
                  <span className="muted mono shrink-0 text-xs">
                    {new Date(a.occurred_at).toLocaleDateString("en-US", {
                      timeZone: "America/Chicago",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-muted)]">{meta.label}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(a.id)}
                    className="text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-danger)]"
                  >
                    delete
                  </button>
                </div>
                {a.note && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
                    {a.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {entries.length > 8 && (
        <button type="button" className="btn btn-sm mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
    </>
  );
}
