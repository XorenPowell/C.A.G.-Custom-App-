"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { deleteSession } from "@/app/actions/face-to-face";

export default function DeleteSessionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2">
      <button
        type="button"
        className="btn btn-danger w-full"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this session and its conversations permanently?")) return;
          start(async () => {
            setError(null);
            const res = await deleteSession(id);
            if (!res.ok) {
              setError(res.error ?? "Delete failed.");
              return;
            }
            router.push("/face-to-face");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete Session"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
