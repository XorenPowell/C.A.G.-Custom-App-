"use client";

import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import SaveBar from "@/components/SaveBar";
import { NumberInput } from "@/components/Form";
import { saveFaceToFaceGoal } from "@/app/actions/settings";

export default function FaceToFaceSettingsEditor({ dailyGoal }: { dailyGoal: number }) {
  const [value, setValue] = useState(String(dailyGoal));
  const [pending, start] = useGlobalTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    start(async () => {
      setError(null);
      const res = await saveFaceToFaceGoal(value);
      if (res.ok) setStatus("Saved.");
      else setError(res.error ?? "Save failed.");
    });
  }

  return (
    <>
      <div className="card card-pad">
        <div className="grid-form">
          <NumberInput
            label="Daily conversation goal"
            min={1}
            step="1"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus(null);
            }}
            hint="Shown on the Work Face to Face home screen as X / Y conversations today. Resets at Chicago midnight."
          />
        </div>
      </div>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
