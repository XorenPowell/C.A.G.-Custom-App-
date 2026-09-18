"use client";

import { useState } from "react";
import SaveBar from "@/components/SaveBar";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { updateConversation } from "@/app/actions/face-to-face";
import { optionsFor, type Lists } from "@/lib/lists";

export default function ConversationEditor({
  id,
  outcomeId,
  intentLevel,
  lists,
}: {
  id: string;
  outcomeId: string | null;
  intentLevel: number;
  lists: Lists;
}) {
  const [pending, start] = useGlobalTransition();
  const [outcome, setOutcome] = useState(outcomeId ?? "");
  const [intent, setIntent] = useState(String(intentLevel));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch() {
    setStatus(null);
  }

  function handleOutcomeChange(next: string) {
    setOutcome(next);
    patch();
    const picked = lists.conversation_outcome.find((o) => o.id === next);
    if (picked?.default_intent_level != null) {
      setIntent(String(picked.default_intent_level));
    }
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await updateConversation(id, outcome || null, intent);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      setStatus("Saved.");
    });
  }

  return (
    <>
      <div className="card card-pad mb-3">
        <div className="field">
          <span className="label">Outcome</span>
          <select
            className="select"
            value={outcome}
            onChange={(e) => handleOutcomeChange(e.target.value)}
          >
            <option value="">— select —</option>
            {optionsFor(lists.conversation_outcome, outcome || null).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="label">Intent level — {intent}/10</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={intent}
            onChange={(e) => {
              setIntent(e.target.value);
              patch();
            }}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
      </div>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
