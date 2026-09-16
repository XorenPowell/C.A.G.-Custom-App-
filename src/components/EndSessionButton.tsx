"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { endSession } from "@/app/actions/face-to-face";

export default function EndSessionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-danger w-full"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("End this session?")) return;
          start(async () => {
            setError(null);
            const res = await endSession(id);
            if (!res.ok) {
              setError(res.error ?? "Could not end the session.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Ending…" : "End Session"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </>
  );
}
