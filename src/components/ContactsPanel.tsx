"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { deleteContact, saveContact, type ContactPayload } from "@/app/actions/contacts";
import { phoneDisplay, phoneLinkTarget } from "@/lib/format";
import type { Contact, ListItem } from "@/lib/types";

const blank = (partnershipId: string): ContactPayload => ({
  id: null, partnership_id: partnershipId, name: "", role_id: null,
  title: null, email: null, phone: null, notes: null,
  source: "Entered manually", email_opt_out: false,
});

/** Any number of people per business, each with a role. */
export default function ContactsPanel({
  partnershipId,
  contacts,
  roles,
}: {
  partnershipId: string;
  contacts: Contact[];
  roles: ListItem[];
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [editing, setEditing] = useState<ContactPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? null;

  function edit(c: Contact) {
    setError(null);
    setEditing({
      id: c.id, partnership_id: partnershipId, name: c.name, role_id: c.role_id,
      title: c.title, email: c.email, phone: c.phone, notes: c.notes,
      source: c.source, email_opt_out: c.email_opt_out,
    });
  }

  function save() {
    if (!editing) return;
    start(async () => {
      setError(null);
      const res = await saveContact(editing);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(c: Contact) {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    start(async () => {
      await deleteContact(c.id);
      router.refresh();
    });
  }

  return (
    <section className="card mb-3">
      <div className="section-title flex items-center justify-between">
        <span>Contacts ({contacts.length})</span>
        {!editing && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setError(null);
              setEditing(blank(partnershipId));
            }}
          >
            + Add
          </button>
        )}
      </div>

      <div className="card-pad">
        {contacts.length === 0 && !editing && (
          <p className="muted text-sm">
            No contacts yet. A contact needs a phone or an email — a bare name belongs in
            the notes.
          </p>
        )}

        {contacts.length > 0 && (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">
                      {c.name}
                      {c.email_opt_out && (
                        <span className="badge ml-1 border-[var(--color-danger)] text-[var(--color-danger)]">
                          no email
                        </span>
                      )}
                    </td>
                    <td>
                      {roleName(c.role_id) ? (
                        <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">
                          {roleName(c.role_id)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted text-xs">{c.email ?? "—"}</td>
                    <td className="muted whitespace-nowrap text-xs">
                      {c.phone ? phoneDisplay(c.phone) : "—"}
                    </td>
                    <td className="text-xs text-[var(--text-faint)]">{c.source ?? "—"}</td>
                    <td>
                      <div className="flex gap-1">
                        {c.phone && (
                          <a className="btn btn-sm" href={`tel:${phoneLinkTarget(c.phone)}`}>
                            Call
                          </a>
                        )}
                        <button type="button" className="btn btn-sm" onClick={() => edit(c)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={pending}
                          onClick={() => remove(c)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <div className="border border-[var(--color-accent)] p-3">
            <div className="grid-form">
              <div className="field">
                <label className="label" htmlFor="ct-name">Name</label>
                <input id="ct-name" className="input" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="ct-role">Role</label>
                <select id="ct-role" className="select" value={editing.role_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, role_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="ct-phone">Phone</label>
                <input id="ct-phone" className="input" value={editing.phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="ct-email">Email</label>
                <input id="ct-email" type="email" className="input" value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="ct-notes">Notes about this person</label>
              <input id="ct-notes" className="input" value={editing.notes ?? ""}
                placeholder="Best caught mornings. Reports to the regional manager."
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>

            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.email_opt_out}
                className="size-4 accent-[var(--color-accent)]"
                onChange={(e) => setEditing({ ...editing, email_opt_out: e.target.checked })} />
              Do not email — excluded from every batch send
            </label>

            {error && (
              <p className="mb-2 border border-[var(--color-danger)] px-2 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
                {pending ? "Saving…" : "Save contact"}
              </button>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
