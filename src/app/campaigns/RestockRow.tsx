"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { markRestocked, removePlacement } from "@/app/actions/campaigns";

/** One stack on the restock run, with the two actions it ever needs. */
export default function RestockRow({
  placementId,
  partnershipId,
  businessName,
  zoneName,
  location,
  cardsLeft,
  intervalDays,
  lastRestock,
  dueLabel,
  tone,
}: {
  placementId: string;
  partnershipId: string;
  businessName: string;
  zoneName: string;
  location: string | null;
  cardsLeft: number | null;
  intervalDays: number;
  lastRestock: string | null;
  dueLabel: string;
  tone: "overdue" | "today" | "upcoming";
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [left, setLeft] = useState<string>(cardsLeft == null ? "" : String(cardsLeft));

  const badge =
    tone === "overdue"
      ? "border-[var(--color-danger)] text-[var(--color-danger)]"
      : tone === "today"
        ? "border-[var(--color-warn)] text-[var(--color-warn)]"
        : "border-[var(--color-line)] text-[var(--color-muted)]";

  function restock() {
    start(async () => {
      await markRestocked(placementId, left === "" ? null : Number(left));
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`End the stack at ${businessName}? Its history is kept.`)) return;
    start(async () => {
      await removePlacement(placementId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line-soft)] px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link href={`/partnerships/${partnershipId}`} className="link font-semibold">
          {businessName}
        </Link>
        <div className="muted text-xs">
          {zoneName}
          {location ? ` · ${location}` : ""} · every {intervalDays}d
          {lastRestock ? ` · last ${lastRestock}` : " · never restocked"}
        </div>
      </div>

      <span className={`badge shrink-0 ${badge}`}>{dueLabel}</span>

      <label className="flex shrink-0 items-center gap-1 text-xs">
        <span className="muted">left</span>
        <input
          className="input w-16 px-1.5 py-1 text-center"
          inputMode="numeric"
          value={left}
          placeholder="—"
          onChange={(e) => setLeft(e.target.value.replace(/\D/g, ""))}
          aria-label={`Cards left at ${businessName}`}
        />
      </label>

      <button type="button" className="btn btn-sm btn-primary shrink-0" disabled={pending} onClick={restock}>
        {pending ? "…" : "Restocked"}
      </button>
      <button type="button" className="btn btn-sm shrink-0" disabled={pending} onClick={remove}>
        End
      </button>
    </div>
  );
}
