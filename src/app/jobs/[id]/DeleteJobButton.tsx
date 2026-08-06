"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteJob } from "@/app/actions/jobs";

export default function DeleteJobButton({ id, jobId }: { id: string; jobId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-16 mt-6 border-t border-[var(--color-line)] pt-4">
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete ${jobId} permanently? Use the Lost or Cancelled status instead if you just want it out of the way.`))
            return;
          start(async () => {
            setError(null);
            const res = await deleteJob(id);
            if (!res.ok) {
              setError(res.error ?? "Delete failed.");
              return;
            }
            router.push("/jobs");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete job"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
