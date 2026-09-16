"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { logConversation } from "@/app/actions/face-to-face";
import { active } from "@/lib/lists";
import type { ListItem } from "@/lib/types";

export default function NewConversationButton({
  sessionId,
  outcomes,
}: {
  sessionId: string;
  outcomes: ListItem[];
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(outcomeId: string) {
    start(async () => {
      setError(null);
      const res = await logConversation(sessionId, outcomeId);
      if (!res.ok) {
        setError(res.error ?? "Could not log conversation.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const options = active(outcomes);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary mb-4 w-full"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        + New Conversation
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-3">What was the outcome?</h2>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="flex flex-col gap-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() => pick(o.id)}
                >
                  {o.name}
                </button>
              ))}
              {options.length === 0 && (
                <p className="muted text-sm">
                  No outcomes set up yet — add some in Settings → Conversation Outcomes.
                </p>
              )}
            </div>

            <button
              type="button"
              className="btn mt-3 w-full"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
