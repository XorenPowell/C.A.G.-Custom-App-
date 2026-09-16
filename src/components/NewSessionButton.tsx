"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { endSession, startSession } from "@/app/actions/face-to-face";
import { optionsFor, type Lists } from "@/lib/lists";
import type { FaceToFaceSession } from "@/lib/types";

export default function NewSessionButton({
  activeSession,
  lists,
}: {
  activeSession: FaceToFaceSession | null;
  lists: Lists;
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [mode, setMode] = useState<null | "resume-warning" | "start-form">(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    conversation_goal: "5",
    committed_hours: "1",
    zone_id: "",
  });

  function openDialog() {
    setError(null);
    setMode(activeSession ? "resume-warning" : "start-form");
  }

  function resume() {
    if (activeSession) router.push(`/face-to-face/sessions/${activeSession.id}`);
  }

  function endAndStartNew() {
    if (!activeSession) return;
    start(async () => {
      setError(null);
      const res = await endSession(activeSession.id);
      if (!res.ok) {
        setError(res.error ?? "Could not end the active session.");
        return;
      }
      router.refresh();
      setMode("start-form");
    });
  }

  function submitStart() {
    start(async () => {
      setError(null);
      await startSession({
        conversation_goal: form.conversation_goal,
        committed_hours: form.committed_hours,
        zone_id: form.zone_id || null,
      });
      // startSession redirects server-side on success — nothing else to do here.
    });
  }

  return (
    <>
      <button type="button" className="btn btn-sm btn-primary shrink-0" onClick={openDialog}>
        + New Session
      </button>

      {mode === "resume-warning" && activeSession && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-2">Session already in progress</h2>
            <p className="muted mb-4 text-sm">
              You have an active session started{" "}
              {new Date(activeSession.started_at).toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              . Resume it, or end it and start a new one?
            </p>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={resume}
                disabled={pending}
              >
                Resume session
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={endAndStartNew}
                disabled={pending}
              >
                {pending ? "Ending…" : "End & start new"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setMode(null)}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "start-form" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <h2 className="h2 mb-3">Ready to start your session?</h2>
            {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="field">
              <label className="label">Conversation goal</label>
              <input
                type="number"
                min={1}
                step="1"
                className="input"
                value={form.conversation_goal}
                onChange={(e) => setForm((f) => ({ ...f, conversation_goal: e.target.value }))}
              />
            </div>
            <div className="field">
              <label className="label">Hours committing to</label>
              <input
                type="number"
                min={0}
                step="0.5"
                className="input"
                value={form.committed_hours}
                onChange={(e) => setForm((f) => ({ ...f, committed_hours: e.target.value }))}
              />
            </div>
            <div className="field">
              <label className="label">Zone</label>
              <select
                className="select"
                value={form.zone_id}
                onChange={(e) => setForm((f) => ({ ...f, zone_id: e.target.value }))}
              >
                <option value="">— select —</option>
                {optionsFor(lists.zone, form.zone_id || null).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn flex-1"
                onClick={() => setMode(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={submitStart}
                disabled={pending}
              >
                {pending ? "Starting…" : "Start session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
