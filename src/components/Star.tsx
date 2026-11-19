"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { setPartnershipStar } from "@/app/actions/partnerships";

/** One five-pointed star, sized by the caller. */
export function StarMark({
  filled,
  size = 16,
  className = "",
}: {
  filled: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinejoin="round"
    >
      <path d="M12 1.8l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.56l-6.18 3.25L7 13.94l-5-4.87 6.91-1z" />
    </svg>
  );
}

/**
 * The star on a partnership's own page.
 *
 * Toggled here rather than from the list: the list rows are links, and a
 * button inside a link is both invalid markup and a trap for a thumb.
 * The list shows the star, this sets it.
 *
 * The mark flips before the write lands and flips back if it fails, so
 * a tap feels immediate without ever showing a state the database does
 * not hold.
 */
export default function StarToggle({
  partnershipId,
  starred,
  size = 26,
}: {
  partnershipId: string;
  starred: boolean;
  size?: number;
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [on, setOn] = useState(starred);

  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await setPartnershipStar(partnershipId, next);
      if (!res.ok) setOn(!next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      title={on ? "Important — click to unstar" : "Mark as important"}
      aria-label={on ? "Remove the star" : "Mark as important"}
      className={`inline-flex shrink-0 items-center transition-opacity disabled:opacity-50 ${
        on
          ? "text-[var(--color-warn)]"
          : "text-[var(--text-faint)] opacity-60 hover:opacity-100"
      }`}
    >
      <StarMark filled={on} size={size} />
    </button>
  );
}
