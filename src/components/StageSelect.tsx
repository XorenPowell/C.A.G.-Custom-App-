"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { setPartnershipStage } from "@/app/actions/activity";
import type { ListItem } from "@/lib/types";

const TONE: Record<string, string> = {
  good: "border-[var(--color-good)] text-[var(--color-good)]",
  warn: "border-[var(--color-warn)] text-[var(--color-warn)]",
  muted: "border-[var(--color-line)] text-[var(--color-muted)]",
};

/**
 * Stage changes constantly, so it is changed here rather than from inside the
 * Edit form. Every change writes a line to the activity trail, which means the
 * history explains itself without anyone writing a note.
 */
export default function StageSelect({
  partnershipId,
  currentId,
  stages,
  tone,
}: {
  partnershipId: string;
  currentId: string | null;
  stages: ListItem[];
  tone: string;
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [value, setValue] = useState(currentId ?? "");

  function change(next: string) {
    const prev = value;
    setValue(next);
    start(async () => {
      const name = stages.find((s) => s.id === next)?.name ?? "";
      const res = await setPartnershipStage(partnershipId, next, name);
      if (!res.ok) setValue(prev);
      router.refresh();
    });
  }

  return (
    <span className="relative inline-flex">
      <select
        aria-label="Stage"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className={`badge cursor-pointer appearance-none bg-transparent py-1 pl-2 pr-6 ${TONE[tone] ?? TONE.muted} disabled:opacity-60`}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-70">
        ▼
      </span>
    </span>
  );
}
