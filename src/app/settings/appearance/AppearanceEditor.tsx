"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import { resetThemeOverrides, saveThemeOverrides } from "@/app/actions/settings";
import { THEME_DEFAULTS, THEME_TOKEN_GROUPS } from "@/lib/theme";

export default function AppearanceEditor({ overrides }: { overrides: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({
    ...THEME_DEFAULTS,
    ...overrides,
  });
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus(null);
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await saveThemeOverrides(values);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      setStatus("Saved.");
      router.refresh();
    });
  }

  function reset() {
    start(async () => {
      setError(null);
      const res = await resetThemeOverrides();
      if (!res.ok) {
        setError(res.error ?? "Reset failed.");
        return;
      }
      setValues({ ...THEME_DEFAULTS });
      setStatus("Reset to default.");
      router.refresh();
    });
  }

  return (
    <>
      <p className="muted mb-3 text-sm">
        Changes apply live, everywhere, as soon as you save — no reload needed.
      </p>

      {THEME_TOKEN_GROUPS.map((g) => (
        <section key={g.group} className="card mb-3">
          <div className="section-title">{g.group}</div>
          <div className="card-pad grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.tokens.map((t) => (
              <label key={t.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{t.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={values[t.key] ?? t.default}
                    onChange={(e) => patch(t.key, e.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer border border-[var(--color-line)] bg-transparent p-0.5"
                  />
                  <span className="mono text-xs text-[var(--color-muted)]">
                    {values[t.key] ?? t.default}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}

      <SaveBar onSave={save} pending={pending} status={status} error={error}>
        <button type="button" className="btn shrink-0" onClick={reset} disabled={pending}>
          Reset to default
        </button>
      </SaveBar>
    </>
  );
}
