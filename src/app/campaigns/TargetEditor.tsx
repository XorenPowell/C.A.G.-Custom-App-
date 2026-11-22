"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { saveCampaignTarget } from "@/app/actions/campaigns";

/** The target is a business decision, so it is editable here, not in SQL. */
export default function TargetEditor({
  campaignId,
  target,
}: {
  campaignId: string;
  target: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(target));
  const [pending, start] = useGlobalTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        Edit target
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        className="input w-20 px-2 py-1 text-center"
        inputMode="numeric"
        value={value}
        aria-label="Campaign target"
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      />
      <button
        type="button"
        className="btn btn-sm btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await saveCampaignTarget(campaignId, value || "0");
            setOpen(false);
            router.refresh();
          })
        }
      >
        {pending ? "…" : "Save"}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          setValue(String(target));
          setOpen(false);
        }}
      >
        Cancel
      </button>
    </span>
  );
}
