"use client";

import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { updateConversationOutcome } from "@/app/actions/face-to-face";
import { optionsFor, type Lists } from "@/lib/lists";

export default function ConversationOutcomeEditor({
  id,
  outcomeId,
  lists,
}: {
  id: string;
  outcomeId: string | null;
  lists: Lists;
}) {
  const [pending, start] = useGlobalTransition();
  const [value, setValue] = useState(outcomeId ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save(next: string) {
    setValue(next);
    setStatus(null);
    start(async () => {
      setError(null);
      const res = await updateConversationOutcome(id, next || null);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      setStatus("Saved.");
    });
  }

  return (
    <div className="card card-pad mb-3">
      <span className="label">Outcome</span>
      <select
        className="select"
        value={value}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
      >
        <option value="">— select —</option>
        {optionsFor(lists.conversation_outcome, value || null).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {status && <p className="mt-1 text-sm text-[var(--color-good)]">{status}</p>}
      {error && <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
