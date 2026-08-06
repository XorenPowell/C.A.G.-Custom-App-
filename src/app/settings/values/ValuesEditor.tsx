"use client";

import { useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import { NumberInput } from "@/components/Form";
import { saveSettingsValues, type SettingsValues } from "@/app/actions/settings";
import type { Settings } from "@/lib/types";

export default function ValuesEditor({ settings }: { settings: Settings }) {
  const [values, setValues] = useState<SettingsValues>({
    default_pos_fee_percent: settings.default_pos_fee_percent,
    monthly_jobs_goal: settings.monthly_jobs_goal,
    daily_leads_goal: settings.daily_leads_goal,
    daily_partnerships_goal: settings.daily_partnerships_goal,
  });
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<SettingsValues>) {
    setValues((v) => ({ ...v, ...next }));
    setStatus(null);
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await saveSettingsValues(values);
      if (res.ok) setStatus("Saved.");
      else setError(res.error ?? "Save failed.");
    });
  }

  return (
    <>
      <div className="card card-pad">
        <div className="grid-form">
          <NumberInput
            label="Default POS fee %"
            step="0.1"
            value={values.default_pos_fee_percent}
            onChange={(e) =>
              patch({ default_pos_fee_percent: Number(e.target.value) })
            }
            hint="Pre-fills new jobs. 5 = 5% of the invoice. Editable per job."
          />
          <NumberInput
            label="Monthly jobs goal"
            step="1"
            value={values.monthly_jobs_goal}
            onChange={(e) => patch({ monthly_jobs_goal: Number(e.target.value) })}
          />
          <NumberInput
            label="Daily leads goal"
            step="1"
            value={values.daily_leads_goal}
            onChange={(e) => patch({ daily_leads_goal: Number(e.target.value) })}
          />
          <NumberInput
            label="Daily partnerships goal"
            step="1"
            value={values.daily_partnerships_goal}
            onChange={(e) =>
              patch({ daily_partnerships_goal: Number(e.target.value) })
            }
          />
        </div>
      </div>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
