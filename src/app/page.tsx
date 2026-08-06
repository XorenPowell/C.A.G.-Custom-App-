import Link from "next/link";
import TopBar from "@/components/TopBar";

/**
 * Menu — the default landing screen.
 * Navigation only. No dashboards, widgets, or job lists here (spec 5.1).
 */
const ITEMS = [
  { href: "/jobs", label: "Jobs", sub: "Inquiries through completion" },
  { href: "/roster", label: "Roster", sub: "Entities, rates, availability" },
  { href: "/partnerships", label: "Partnerships", sub: "Referral sources" },
  { href: "/dashboard", label: "Dashboard", sub: "Volume, revenue, goals" },
  { href: "/settings", label: "Settings", sub: "Lists, templates, calendar" },
];

export default function MenuPage() {
  return (
    <>
      <TopBar title="C.A.G. Dispatch" back={null} />
      <main className="page max-w-2xl">
        <nav className="flex flex-col gap-2">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-sunken)]"
            >
              <span>
                <span className="block text-lg font-bold">{item.label}</span>
                <span className="block text-sm text-[var(--color-muted)]">{item.sub}</span>
              </span>
              <span aria-hidden className="text-xl text-[var(--color-muted)]">
                ›
              </span>
            </Link>
          ))}
        </nav>
      </main>
    </>
  );
}
