"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { markEmailed } from "@/app/actions/contacts";
import { phoneDisplay, phoneLinkTarget } from "@/lib/format";
import type { ContactWithPartnership } from "@/lib/contacts";
import type { ListItem } from "@/lib/types";

/**
 * The business-card stack, segmentable.
 *
 * Selection is per-row rather than "email this whole filter" because a
 * segment is almost right — you filter to Property Managers, then drop the
 * two you spoke to yesterday.
 */
export default function ContactsBrowser({
  contacts,
  roles,
  zones,
}: {
  contacts: ContactWithPartnership[];
  roles: ListItem[];
  zones: ListItem[];
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [zone, setZone] = useState("");
  const [reach, setReach] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);

  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (role && c.role_id !== role) return false;
      if (zone && c.zone_id !== zone) return false;
      if (reach === "email" && !c.email) return false;
      if (reach === "phone" && !c.phone) return false;
      if (reach === "never" && c.last_emailed_at) return false;
      if (needle) {
        const hay = [c.name, c.email, c.phone, c.partnership_name, c.notes]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [contacts, q, role, zone, reach]);

  // Only contacts who can actually be emailed and have not opted out.
  const mailable = rows.filter((c) => c.email && !c.email_opt_out);
  const selected = contacts.filter((c) => sel.has(c.id));
  const selectedMailable = selected.filter((c) => c.email && !c.email_opt_out);

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllMailable() {
    const ids = mailable.map((c) => c.id);
    const allOn = ids.every((id) => sel.has(id));
    setSel((prev) => {
      const next = new Set(prev);
      for (const id of ids) allOn ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const roleCounts = roles
    .map((r) => ({ r, n: contacts.filter((c) => c.role_id === r.id).length }))
    .filter((x) => x.n > 0);

  return (
    <>
      <div className="mb-3 -mx-3 flex gap-1 overflow-x-auto px-3 md:mx-0 md:px-0 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button className={`btn btn-sm ${!role ? "btn-primary" : ""}`} onClick={() => setRole("")}>
          All ({contacts.length})
        </button>
        {roleCounts.map(({ r, n }) => (
          <button
            key={r.id}
            className={`btn btn-sm ${role === r.id ? "btn-primary" : ""}`}
            onClick={() => setRole(r.id)}
          >
            {r.name} ({n})
          </button>
        ))}
      </div>

      <div className="card card-pad mb-3">
        <div className="grid-form">
          <div className="field">
            <label className="label" htmlFor="c-q">Search</label>
            <input id="c-q" className="input" value={q} placeholder="Name, email, business"
              onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="c-zone">Zone</label>
            <select id="c-zone" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">All zones</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="c-reach">Reachable by</label>
            <select id="c-reach" className="select" value={reach} onChange={(e) => setReach(e.target.value)}>
              <option value="">Anything</option>
              <option value="email">Has an email</option>
              <option value="phone">Has a phone</option>
              <option value="never">Never emailed</option>
            </select>
          </div>
          <div className="field">
            <span className="label">&nbsp;</span>
            <button type="button" className="btn w-full" onClick={selectAllMailable}>
              Select {mailable.length} emailable
            </button>
          </div>
        </div>
      </div>

      <p className="muted mb-2 text-sm">
        {rows.length} of {contacts.length}
        {sel.size > 0 && ` · ${sel.size} selected`}
      </p>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((c) => (
          <div key={c.id} className="card card-pad flex gap-3">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]"
              checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="muted text-xs">
                {roleName(c.role_id) ?? "—"}
                {c.partnership_name ? ` · ${c.partnership_name}` : ""}
              </div>
              <div className="muted text-xs">{c.email ?? phoneDisplay(c.phone)}</div>
              {c.email_opt_out && (
                <span className="badge mt-1 border-[var(--color-danger)] text-[var(--color-danger)]">
                  no email
                </span>
              )}
            </div>
            {c.phone && (
              <a className="btn btn-sm self-start" href={`tel:${phoneLinkTarget(c.phone)}`}>Call</a>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="muted card card-pad text-sm">No contacts match.</p>}
      </div>

      {/* Desktop */}
      <div className="card hidden md:block">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }}></th>
                <th>Name</th><th>Role</th><th>Business</th><th>Email</th>
                <th>Phone</th><th>Last emailed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input type="checkbox" className="size-4 accent-[var(--color-accent)]"
                      checked={sel.has(c.id)} onChange={() => toggle(c.id)}
                      aria-label={`Select ${c.name}`} />
                  </td>
                  <td className="font-semibold">
                    {c.name}
                    {c.source === "Business card" && (
                      <span className="badge ml-1 border-[var(--color-line)] text-[10px] text-[var(--text-faint)]">
                        card
                      </span>
                    )}
                    {c.email_opt_out && (
                      <span className="badge ml-1 border-[var(--color-danger)] text-[var(--color-danger)]">
                        no email
                      </span>
                    )}
                  </td>
                  <td className="text-xs">{roleName(c.role_id) ?? "—"}</td>
                  <td>
                    {c.partnership_id ? (
                      <Link href={`/partnerships/${c.partnership_id}`} className="link">
                        {c.partnership_name}
                      </Link>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td className="muted text-xs">{c.email ?? "—"}</td>
                  <td className="muted text-xs">{c.phone ? phoneDisplay(c.phone) : "—"}</td>
                  <td className="muted mono text-xs">
                    {c.last_emailed_at
                      ? new Date(c.last_emailed_at).toLocaleDateString("en-US", {
                          timeZone: "America/Chicago", month: "numeric", day: "numeric", year: "2-digit" })
                      : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="muted">No contacts match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sel.size > 0 && (
        <div className="sticky bottom-0 z-20 mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] bg-[var(--panel-raised)] px-3 py-2">
          <span className="text-sm">
            <strong>{sel.size}</strong> selected
            {selectedMailable.length !== sel.size && (
              <span className="muted"> · {selectedMailable.length} emailable</span>
            )}
          </span>
          <div className="flex-1" />
          <button className="btn btn-sm" onClick={() => setSel(new Set())}>Clear</button>
          <button className="btn btn-sm btn-primary" disabled={selectedMailable.length === 0}
            onClick={() => setComposing(true)}>
            Email {selectedMailable.length}
          </button>
        </div>
      )}

      {composing && (
        <EmailComposer
          contacts={selectedMailable}
          onClose={() => setComposing(false)}
          onSent={() => { setComposing(false); setSel(new Set()); }}
        />
      )}
    </>
  );
}

/**
 * Composes in the app and hands off to the device's mail client, exactly like
 * the sms:/tel: actions elsewhere. Nothing is sent from a server, so this app
 * never carries a sending reputation — but CAN-SPAM still applies to what you
 * send, which is why the footer is built in and the opt-outs are excluded.
 */
function EmailComposer({
  contacts,
  onClose,
  onSent,
}: {
  contacts: ContactWithPartnership[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("Quick intro — Call A Guy Chicago");
  const [body, setBody] = useState(
    `Hi there,\n\nI run Call A Guy Chicago — we handle moving, cleaning, junk removal and handyman work.\n\nIf a tenant ever needs a hand, we can usually be there same day.\n\n— Xoren`,
  );
  const [copied, setCopied] = useState(false);

  const emails = contacts.map((c) => c.email!).filter(Boolean);
  const FOOTER =
    "\n\n—\nCall A Guy Chicago · Chicago, IL\nReply STOP or email back to be removed from this list.";
  const full = body + FOOTER;

  const mailto =
    `mailto:?bcc=${encodeURIComponent(emails.join(","))}` +
    `&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`;
  // Most mail clients choke somewhere past ~2000 characters in a URL.
  const tooLong = mailto.length > 1900;

  async function copyAll() {
    await navigator.clipboard.writeText(emails.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="card max-h-[88vh] w-full max-w-2xl overflow-auto">
        <div className="section-title flex items-center justify-between">
          <span>Email {contacts.length} contacts</span>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="card-pad">
          <div className="field">
            <label className="label" htmlFor="em-sub">Subject</label>
            <input id="em-sub" className="input" value={subject}
              onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="em-body">Body</label>
            <textarea id="em-body" className="textarea" rows={8} value={body}
              onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="mb-3 border-l-[3px] border-[var(--color-accent)] bg-[var(--panel-raised)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <strong className="text-[var(--color-ink)]">Added automatically:</strong>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{FOOTER.trim()}</pre>
            <p className="mt-2">
              Every commercial email needs a working opt-out and a real postal address.
              CAN-SPAM covers B2B the same as B2C, and a business card is not consent.
              Contacts marked <em>no email</em> are already excluded.
            </p>
          </div>

          {tooLong && (
            <p className="mb-3 border border-[var(--color-warn)] px-2 py-2 text-sm text-[var(--color-warn)]">
              This is too long for a mail link at {contacts.length} recipients. Copy the
              addresses instead and paste them into the BCC field of a new message.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={copyAll}>
              {copied ? "Copied" : "Copy addresses"}
            </button>
            {!tooLong && (
              <a className="btn btn-primary" href={mailto} onClick={onSent}>
                Open in mail app
              </a>
            )}
            <button className="btn" onClick={async () => {
              await markEmailed(contacts.map((c) => c.id));
              onSent();
            }}>
              Mark as emailed
            </button>
          </div>

          <p className="muted mt-2 text-xs">
            Addresses go in BCC so recipients never see each other.
          </p>
        </div>
      </div>
    </div>
  );
}
