"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import SaveBar from "@/components/SaveBar";
import { resetThemeOverrides, saveThemeOverrides } from "@/app/actions/settings";
import {
  DEFAULT_ELEVATION,
  DEFAULT_SURFACE,
  ELEVATION_KEY,
  ELEVATION_PRESETS,
  SURFACE_KEY,
  SURFACE_PRESETS,
  THEME_DEFAULTS,
  THEME_TOKEN_GROUPS,
} from "@/lib/theme";

export default function AppearanceEditor({ overrides }: { overrides: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({
    ...THEME_DEFAULTS,
    [SURFACE_KEY]: DEFAULT_SURFACE,
    [ELEVATION_KEY]: DEFAULT_ELEVATION,
    ...overrides,
  });

  // The whole document re-skins on pick, so the choice is judged against the
  // real app rather than a swatch. Saving only persists what is already
  // on screen.
  function preview(key: string, value: string) {
    patch(key, value);
    const attr = key === SURFACE_KEY ? "data-surface" : "data-elevation";
    document.body.setAttribute(attr, value);
  }
  const [pending, start] = useGlobalTransition();
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
      setValues({
        ...THEME_DEFAULTS,
        [SURFACE_KEY]: DEFAULT_SURFACE,
        [ELEVATION_KEY]: DEFAULT_ELEVATION,
      });
      document.body.setAttribute("data-surface", DEFAULT_SURFACE);
      document.body.setAttribute("data-elevation", DEFAULT_ELEVATION);
      setStatus("Reset to default.");
      router.refresh();
    });
  }

  return (
    <>
      <p className="muted mb-3 text-sm">
        Surface and elevation preview immediately as you pick them. Colours apply
        everywhere once saved — no reload needed.
      </p>

      <section className="card mb-3">
        <div className="section-title">Surface</div>
        <div className="card-pad">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SURFACE_PRESETS.map((s) => {
              const on = (values[SURFACE_KEY] ?? DEFAULT_SURFACE) === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => preview(SURFACE_KEY, s.id)}
                  className={`rounded-[var(--radius-card)] border p-2 text-left ${
                    on
                      ? "border-[var(--color-accent)] bg-[var(--pill-active-bg)]"
                      : "border-[var(--color-line)] hover:bg-[var(--panel-raised)]"
                  }`}
                >
                  <span
                    data-surface={s.id}
                    aria-hidden
                    className="mb-1.5 block h-12 w-full rounded-[6px] border border-[var(--color-line)]"
                    style={{ backgroundColor: "var(--bg)" }}
                  />
                  <span className="block text-[13px] font-semibold">{s.label}</span>
                  <span className="block text-[11px] leading-snug text-[var(--text-faint)]">
                    {s.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card mb-3">
        <div className="section-title">Elevation</div>
        <div className="card-pad">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ELEVATION_PRESETS.map((e) => {
              const on = (values[ELEVATION_KEY] ?? DEFAULT_ELEVATION) === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => preview(ELEVATION_KEY, e.id)}
                  className={`rounded-[var(--radius-card)] border p-2 text-left ${
                    on
                      ? "border-[var(--color-accent)] bg-[var(--pill-active-bg)]"
                      : "border-[var(--color-line)] hover:bg-[var(--panel-raised)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className="mb-1.5 block h-10 w-full rounded-[6px] border border-[var(--color-line)] bg-[var(--panel)]"
                    style={{
                      boxShadow:
                        e.id === "none"
                          ? "none"
                          : e.id === "soft"
                            ? "0 1px 2px rgba(0,0,0,.3)"
                            : e.id === "lifted"
                              ? "0 1px 2px rgba(0,0,0,.28), 0 3px 8px -2px rgba(0,0,0,.4)"
                              : "0 1px 2px rgba(0,0,0,.3), 0 10px 26px -8px rgba(0,0,0,.6)",
                    }}
                  />
                  <span className="block text-[13px] font-semibold">{e.label}</span>
                  <span className="block text-[11px] leading-snug text-[var(--text-faint)]">
                    {e.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

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
