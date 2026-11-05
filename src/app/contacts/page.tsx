import TopBar from "@/components/TopBar";
import { getContacts } from "@/lib/contacts";
import { active, getLists } from "@/lib/data";
import ContactsBrowser from "./ContactsBrowser";

export default async function ContactsPage() {
  const [contacts, lists] = await Promise.all([getContacts(), getLists()]);

  const partnerships = new Set(contacts.map((c) => c.partnership_id).filter(Boolean));

  return (
    <>
      <TopBar
        title="Contacts"
        back={null}
        action={
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn btn-sm" disabled title="Not built yet">
              Scan card
            </button>
          </div>
        }
      />
      <main className="page">
        <p className="muted mb-3 text-sm">
          {contacts.length} people across {partnerships.size} partnerships. Contacts are
          added from a partnership; one needs a phone or an email to be worth keeping.
        </p>

        <ContactsBrowser
          contacts={contacts}
          roles={active(lists.contact_role)}
          zones={active(lists.zone)}
        />
      </main>
    </>
  );
}
