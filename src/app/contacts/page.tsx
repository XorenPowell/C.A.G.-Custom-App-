import TopBar from "@/components/TopBar";
import { getContacts } from "@/lib/contacts";
import { active, getLists } from "@/lib/data";
import ContactsBrowser from "./ContactsBrowser";

export default async function ContactsPage() {
  const [contacts, lists] = await Promise.all([getContacts(), getLists()]);

  const withEmail = contacts.filter((c) => c.email).length;
  const optedOut = contacts.filter((c) => c.email_opt_out).length;

  return (
    <>
      <TopBar title="Contacts" />
      <main className="page">
        <p className="muted mb-3 text-sm">
          {contacts.length} people · {withEmail} with an email
          {optedOut > 0 ? ` · ${optedOut} opted out` : ""}. Contacts are added from a
          partnership; a contact needs a phone or an email to be worth keeping.
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
