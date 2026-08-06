"use client";

import { useState } from "react";
import {
  buildContext,
  resolveTemplate,
  type TemplateEntity,
  type TemplateJob,
} from "@/lib/templates";
import { phoneDisplay, phoneLinkTarget } from "@/lib/format";
import type { MessageTemplate } from "@/lib/types";

/**
 * Communication actions (spec section 6).
 *
 * There is no messaging API here by design. Templates are resolved against live
 * job data and handed to the device via `sms:` / `tel:`. Prefill support varies
 * by device, so every message also offers copy-to-clipboard.
 */

type Target = { label: string; phone: string | null; entity?: TemplateEntity };

export default function CommsActions({
  job,
  serviceCategory,
  zone,
  entities,
  templates,
}: {
  job: TemplateJob;
  serviceCategory: string;
  zone: string;
  entities: TemplateEntity[];
  templates: MessageTemplate[];
}) {
  const [sheet, setSheet] = useState<null | { mode: "Customer" | "Worker" }>(null);

  const customerTarget: Target = {
    label: job.customer_name || "Customer",
    phone: job.customer_phone,
  };
  const entityTargets: Target[] = entities.map((e) => ({
    label: `${e.entity_name}${e.poc_name ? ` (${e.poc_name})` : ""}`,
    phone: e.poc_phone,
    entity: e,
  }));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <CallButton label="Call customer" phone={customerTarget.phone} />
        <button
          type="button"
          className="btn"
          onClick={() => setSheet({ mode: "Customer" })}
          disabled={!customerTarget.phone}
        >
          Text customer
        </button>

        {entityTargets.length === 0 ? (
          <span className="muted self-center text-sm">No workers assigned yet.</span>
        ) : (
          <>
            {entityTargets.length === 1 ? (
              <CallButton label="Call entity POC" phone={entityTargets[0].phone} />
            ) : (
              <details className="relative">
                <summary className="btn cursor-pointer list-none">Call entity POC</summary>
                <div className="absolute z-10 mt-1 w-64 border border-[var(--color-line)] bg-white p-1">
                  {entityTargets.map((t, i) => (
                    <CallButton
                      key={i}
                      label={t.label}
                      phone={t.phone}
                      className="mb-1 w-full justify-start"
                    />
                  ))}
                </div>
              </details>
            )}
            <button type="button" className="btn" onClick={() => setSheet({ mode: "Worker" })}>
              Text entity POC
            </button>
          </>
        )}
      </div>

      {sheet && (
        <MessageSheet
          mode={sheet.mode}
          job={job}
          serviceCategory={serviceCategory}
          zone={zone}
          entities={entities}
          targets={sheet.mode === "Customer" ? [customerTarget] : entityTargets}
          templates={templates.filter((t) => t.audience === sheet.mode)}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

function CallButton({
  label,
  phone,
  className = "",
}: {
  label: string;
  phone: string | null | undefined;
  className?: string;
}) {
  if (!phone) {
    return (
      <button type="button" className={`btn ${className}`} disabled>
        {label}
      </button>
    );
  }
  return (
    <a href={`tel:${phoneLinkTarget(phone)}`} className={`btn ${className}`}>
      {label}
    </a>
  );
}

function MessageSheet({
  mode,
  job,
  serviceCategory,
  zone,
  entities,
  targets,
  templates,
  onClose,
}: {
  mode: "Customer" | "Worker";
  job: TemplateJob;
  serviceCategory: string;
  zone: string;
  entities: TemplateEntity[];
  targets: Target[];
  templates: MessageTemplate[];
  onClose: () => void;
}) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const target = targets[targetIndex];
  const template = templates.find((t) => t.id === templateId) ?? null;

  const ctx = buildContext(job, serviceCategory, zone, entities, target?.entity ?? null);
  const body = template ? resolveTemplate(template.body, ctx) : "";

  // `sms:NUMBER?&body=` is the form that prefills on both iOS and Android.
  const smsHref = target?.phone
    ? `sms:${phoneLinkTarget(target.phone)}?&body=${encodeURIComponent(body)}`
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col border border-[var(--color-line)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
          <h2 className="h2 flex-1">Text {mode.toLowerCase()}</h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {targets.length > 1 && (
            <div className="field">
              <span className="label">Recipient</span>
              <select
                className="select"
                value={targetIndex}
                onChange={(e) => setTargetIndex(Number(e.target.value))}
              >
                {targets.map((t, i) => (
                  <option key={i} value={i}>
                    {t.label} {t.phone ? `· ${phoneDisplay(t.phone)}` : "· no phone"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <span className="label">Template</span>
            {templates.length === 0 ? (
              <p className="muted text-sm">
                No {mode} templates yet. Add one in Settings → Message Templates.
              </p>
            ) : (
              <select
                className="select"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.template_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field">
            <span className="label">Message — sends exactly as shown</span>
            <div className="min-h-24 whitespace-pre-wrap border border-[var(--color-line)] bg-[var(--color-sunken)] p-2 text-sm">
              {body || <span className="muted italic">This template has an empty body.</span>}
            </div>
            {target?.phone && (
              <p className="muted mt-1 text-xs">To: {phoneDisplay(target.phone)}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--color-line)] p-3">
          <button type="button" className="btn flex-1" onClick={copy} disabled={!body}>
            {copied ? "Copied ✓" : "Copy text"}
          </button>
          {smsHref ? (
            <a href={smsHref} className="btn btn-primary flex-1">
              Open Messages
            </a>
          ) : (
            <button type="button" className="btn btn-primary flex-1" disabled>
              No phone number
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
