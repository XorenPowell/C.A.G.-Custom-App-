"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePartnership } from "@/app/actions/partnerships";

export default function DeletePartnershipButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
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
          if (!window.confirm(`Delete "${name}" permanently?`)) return;
          start(async () => {
            setError(null);
            const res = await deletePartnership(id);
            if (!res.ok) {
              setError(res.error ?? "Delete failed.");
              return;
            }
            router.push("/partnerships");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete partnership"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
