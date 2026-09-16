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
  const [outcomeId, setOutcomeId] = useState("");
  const [intentLevel, setIntentLevel] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const options = active(outcomes);

  function openDialog() {
    setError(null);
    setOutcomeId("");
    setIntentLevel("5");
    setOpen(true);
  }

  function submit() {
    if (!outcomeId) {
      setError("Pick an outcome.");
      return;
    }
    start(async () => {
      setError(null);
      const res = await logConversation(sessionId, outcomeId, intentLevel);
      if (!res.ok) {
        setError(res.error ?? "Could not log conversation.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn btn-primary mb-4 w-full" onClick={openDialog}>
        + New Conversation
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-3">Log conversation</h2>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="field">
              <label className="label">Outcome</label>
              <select
                className="select"
                value={outcomeId}
                onChange={(e) => setOutcomeId(e.target.value)}
              >
                <option value="">— select —</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              {options.length === 0 && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  No outcomes set up yet — add some in Settings → Conversation Outcomes.
                </p>
              )}
            </div>

            <div className="field">
              <label className="label">Intent level — {intentLevel}/10</label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={intentLevel}
                onChange={(e) => setIntentLevel(e.target.value)}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn flex-1"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Saving…" : "Log Conversation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
