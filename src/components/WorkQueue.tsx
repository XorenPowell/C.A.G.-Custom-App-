"use client";

import Link from "next/link";
import { useState } from "react";
import { phoneLinkTarget } from "@/lib/format";
import type { QueueItem } from "@/lib/home";

type Tab = "calls" | "restocks" | "none";

const KIND_BADGE: Record<QueueItem["kind"], string> = {
  partnership: "PARTNER",
  job: "JOB",
  restock: "STACK",
};

/**
 * One list of everything needing attention, across partnerships, jobs and
 * campaign restocks. Overdue items lead; "No next action" is its own tab
 * because a record with nothing scheduled appears in no due-based list and
 * would otherwise never resurface.
 */
export default function WorkQueue({
  calls,
  restocks,
  noAction,
  failure,
}: {
  calls: QueueItem[];
  restocks: QueueItem[];
  noAction: QueueItem[];
  failure?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("calls");
  const items = tab === "calls" ? calls : tab === "restocks" ? restocks : noAction;
  const overdueCalls = calls.filter((c) => c.state === "overdue").length;

  const Pill = ({ id, label, n, warn }: { id: Tab; label: string; n: number; warn?: boolean }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`btn btn-sm ${tab === id ? "btn-primary" : ""}`}
    >
      {label}{" "}
      <span
        className={
          tab === id ? "" : warn && n > 0 ? "text-[var(--color-danger)]" : "text-[var(--text-faint)]"
        }
      >
        {n}
      </span>
    </button>
  );

  // An empty queue and a broken queue look identical, so say which it is.
  if (failure) {
    return (
      <div className="card border-[var(--color-danger)]">
        <div className="section-title">Work queue</div>
        <div className="card-pad">
          <p className="text-sm font-semibold text-[var(--color-danger)]">
            The queue could not be loaded, so this is not &ldquo;nothing due&rdquo;.
          </p>
          <p className="muted mt-1 text-xs">{failure}</p>
          <p className="muted mt-2 text-xs">
            If this names a missing column, a migration has not been applied to this
            database yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title">Work queue</div>

      <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pt-3 md:mx-0 md:px-4 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Pill id="calls" label="Calls" n={calls.length} warn={overdueCalls > 0} />
        <Pill id="restocks" label="Restocks" n={restocks.length} />
        <Pill id="none" label="No next action" n={noAction.length} warn />
      </div>

      {items.length === 0 ? (
        <p className="muted card-pad text-sm">
          {tab === "calls"
            ? "No calls due. Nice."
            : tab === "restocks"
              ? "No stacks need restocking."
              : "Everything has a next step booked."}
        </p>
      ) : (
        <ul className="m-0 mt-2 list-none p-0">
          {items.map((it) => (
            <li
              key={`${it.kind}-${it.id}`}
              className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line-soft)] px-3 py-2.5 md:px-4"
            >
              <span
                className={`badge shrink-0 ${
                  it.state === "overdue"
                    ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                    : "border-[var(--color-warn)] text-[var(--color-warn)]"
                }`}
              >
                {it.dueLabel}
              </span>

              <div className="min-w-0 flex-1 basis-full md:basis-auto">
                <Link href={it.href} className="link font-semibold">
                  {it.title}
                </Link>
                <span className="badge ml-2 border-[var(--color-line)] text-[10px] text-[var(--text-faint)]">
                  {KIND_BADGE[it.kind]}
                </span>
                {it.followKind && it.followKind !== "call" && (
                  <span className="badge ml-1 border-[var(--color-accent)] text-[10px] text-[var(--color-accent)]">
                    {it.followKind.toUpperCase()}
                  </span>
                )}
                <div className="muted truncate text-xs">{it.subtitle}</div>
              </div>

              <div className="ml-auto flex shrink-0 gap-1">
                {/* A visit is not answered by dialling, so the shortcut only
                    appears when the booked contact is actually a call or text. */}
                {it.phone && (it.followKind ?? "call") !== "visit" && (
                  <a
                    className="btn btn-sm"
                    href={`${it.followKind === "text" ? "sms" : "tel"}:${phoneLinkTarget(it.phone)}`}
                  >
                    {it.followKind === "text" ? "Text" : "Call"}
                  </a>
                )}
                <Link className="btn btn-sm" href={it.href}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
