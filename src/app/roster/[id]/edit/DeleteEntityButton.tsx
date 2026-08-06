"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteEntity } from "@/app/actions/entities";

export default function DeleteEntityButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-16">
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete "${name}" permanently?`)) return;
          start(async () => {
            setError(null);
            const res = await deleteEntity(id);
            if (!res.ok) {
              setError(res.error ?? "Delete failed.");
              return;
            }
            router.push("/roster");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete entity"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
