"use client";

import { useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import { deleteTemplate, saveTemplates, type TemplateDraft } from "@/app/actions/settings";
import { TEMPLATE_VARS, unknownTokens } from "@/lib/templates";
import { AUDIENCES, type Audience, type MessageTemplate } from "@/lib/types";

export default function TemplatesEditor({ templates }: { templates: MessageTemplate[] }) {
  const [rows, setRows] = useState<TemplateDraft[]>(
    templates.map((t) => ({
      id: t.id,
      template_name: t.template_name,
      audience: t.audience,
      body: t.body,
    })),
  );
  const [filter, setFilter] = useState<Audience | "All">("All");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(index: number, next: Partial<TemplateDraft>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
    setStatus(null);
  }

  function add() {
    setRows((prev) => [
      ...prev,
      { id: null, template_name: "", audience: "Customer", body: "" },
    ]);
    setStatus(null);
  }

  function removeRow(index: number) {
    const row = rows[index];
    if (!row.id) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (!window.confirm(`Delete template "${row.template_name}"?`)) return;
    start(async () => {
      const res = await deleteTemplate(row.id!);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        return;
      }
      setRows((prev) => prev.filter((_, i) => i !== index));
      setStatus("Deleted.");
    });
  }

  function insertVar(index: number, token: string) {
    patch(index, { body: `${rows[index].body ?? ""}{{${token}}}` });
  }

  function save() {
    start(async () => {
      setError(null);
      setStatus(null);
      const res = await saveTemplates(rows);
      if (res.ok) setStatus("Saved.");
      else setError(res.error ?? "Save failed.");
    });
  }

  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => filter === "All" || row.audience === filter);

  return (
    <>
      <div className="card card-pad mb-3">
        <span className="label">Variables — tap to append to the open template</span>
        <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {TEMPLATE_VARS.map((v) => (
            <li key={v.token} className="flex gap-2">
              <code className="mono shrink-0 bg-[var(--color-sunken)] px-1">
                {`{{${v.token}}}`}
              </code>
              <span className="muted truncate">{v.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3 flex gap-2">
        {(["All", ...AUDIENCES] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setFilter(a)}
            className={`btn btn-sm ${filter === a ? "btn-primary" : ""}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {visible.map(({ row, index }) => {
          const bad = unknownTokens(row.body);
          return (
            <div key={row.id ?? `new-${index}`} className="card card-pad">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                <input
                  className="input sm:flex-1"
                  placeholder="Template name"
                  value={row.template_name}
                  onChange={(e) => patch(index, { template_name: e.target.value })}
                />
                <select
                  className="select sm:w-40"
                  value={row.audience}
                  onChange={(e) =>
                    patch(index, { audience: e.target.value as Audience })
                  }
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                className="textarea mb-2"
                placeholder="Message body — use {{variables}} above"
                value={row.body}
                onChange={(e) => patch(index, { body: e.target.value })}
              />

              {bad.length > 0 && (
                <p className="mb-2 text-xs text-[var(--color-warn)]">
                  Unrecognised variable{bad.length > 1 ? "s" : ""}:{" "}
                  {bad.map((t) => `{{${t}}}`).join(", ")} — these will send as-is.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1">
                <select
                  className="select w-auto min-w-40"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertVar(index, e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Insert variable…</option>
                  {TEMPLATE_VARS.map((v) => (
                    <option key={v.token} value={v.token}>
                      {v.token}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-danger ml-auto"
                  onClick={() => removeRow(index)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn mt-3" onClick={add}>
        + Add template
      </button>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
