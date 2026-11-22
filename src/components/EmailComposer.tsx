"use client";

import { useState } from "react";
import { markEmailed } from "@/app/actions/contacts";

export type Recipient = { id: string; name: string; email: string | null };

const FOOTER =
  "\n\n—\nCall A Guy Chicago · Chicago, IL\nReply STOP or email back to be removed from this list.";

/**
 * Write the message here, then either copy the pieces out or hand the whole
 * thing to Gmail prefilled.
 *
 * Shared by the single-contact button and the batch send, so one recipient
 * and forty behave identically — the only difference is `to` versus `bcc`.
 * Gmail's web composer rather than mailto:, which only opens when the
 * operating system has a mail client registered, and often it has none.
 */
export default function EmailComposer({
  recipients,
  onClose,
  onSent,
  defaultSubject = "Quick intro — Call A Guy Chicago",
  defaultBody,
}: {
  recipients: Recipient[];
  onClose: () => void;
  onSent?: () => void;
  defaultSubject?: string;
  defaultBody?: string;
}) {
  const single = recipients.length === 1;
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(
    defaultBody ??
      (single
        ? `Hi ${recipients[0].name.split(" ")[0]},\n\nI run Call A Guy Chicago — we handle moving, cleaning, junk removal and handyman work.\n\nIf a tenant ever needs a hand, we can usually be there same day.\n\n— Xoren`
        : `Hi there,\n\nI run Call A Guy Chicago — we handle moving, cleaning, junk removal and handyman work.\n\nIf a tenant ever needs a hand, we can usually be there same day.\n\n— Xoren`),
  );
  const [copied, setCopied] = useState<"none" | "address" | "message">("none");

  const emails = recipients.map((r) => r.email).filter((e): e is string => !!e);
  const full = body + FOOTER;

  // One recipient goes in To; several go in Bcc so they never see each other.
  const params = new URLSearchParams({ view: "cm", fs: "1", su: subject, body: full });
  params.set(single ? "to" : "bcc", emails.join(","));
  const composeHref = `https://mail.google.com/mail/?${params.toString()}`;
  const tooLong = composeHref.length > 7000;

  async function copy(what: "address" | "message") {
    await navigator.clipboard.writeText(what === "address" ? emails.join(", ") : full);
    setCopied(what);
    setTimeout(() => setCopied("none"), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="card max-h-[88vh] w-full max-w-2xl overflow-auto">
        <div className="section-title flex items-center justify-between">
          <span>
            {single ? `Email ${recipients[0].name}` : `Email ${recipients.length} contacts`}
          </span>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="card-pad">
          <div className="field">
            <span className="label">{single ? "To" : "Bcc"}</span>
            <p className="muted break-words text-sm">{emails.join(", ") || "no addresses"}</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="em-sub">Subject</label>
            <input
              id="em-sub"
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="em-body">Message</label>
            <textarea
              id="em-body"
              className="textarea"
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="note">
            <strong className="text-[var(--color-ink)]">Added automatically:</strong>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{FOOTER.trim()}</pre>
            <p className="mt-2">
              Every commercial email needs a working opt-out and a real postal address.
              CAN-SPAM covers B2B the same as B2C, and a business card is not consent.
              Contacts marked <em>no email</em> are excluded.
            </p>
          </div>

          {tooLong && (
            <p className="note border-[var(--color-warn)] text-[var(--color-warn)]">
              Too long for a compose link at {recipients.length} recipients. Copy the
              address list and the message instead, and paste them into a new email.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => copy("address")}>
              {copied === "address" ? "Copied" : single ? "Copy address" : "Copy addresses"}
            </button>
            <button className="btn" onClick={() => copy("message")}>
              {copied === "message" ? "Copied" : "Copy message"}
            </button>
            {!tooLong && (
              <a
                className="btn btn-primary"
                href={composeHref}
                target="_blank"
                rel="noreferrer"
                onClick={async () => {
                  await markEmailed(recipients.map((r) => r.id));
                  onSent?.();
                }}
              >
                Open in Gmail
              </a>
            )}
            <button
              className="btn"
              onClick={async () => {
                await markEmailed(recipients.map((r) => r.id));
                onSent?.();
              }}
            >
              Mark as emailed
            </button>
          </div>

          <p className="muted mt-2 text-xs">
            {single
              ? "Opens Gmail with the address and message already filled in."
              : "Addresses go in Bcc so recipients never see each other."}
          </p>
        </div>
      </div>
    </div>
  );
}
