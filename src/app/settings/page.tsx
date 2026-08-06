import Link from "next/link";
import TopBar from "@/components/TopBar";
import { signOut } from "@/app/actions/auth";

const SECTIONS = [
  { href: "/settings/lists/service_category", label: "Service Categories" },
  { href: "/settings/lists/lead_source", label: "Lead Sources" },
  { href: "/settings/lists/zone", label: "Zones" },
  { href: "/settings/lists/vehicle_type", label: "Vehicle Types" },
  { href: "/settings/lists/partnership_status", label: "Partnership Statuses" },
  { href: "/settings/lists/partnership_tier", label: "Partnership Tiers" },
  { href: "/settings/equipment", label: "Equipment Presets" },
  { href: "/settings/zones", label: "Zone Reference" },
  { href: "/settings/values", label: "Values & Goals" },
  { href: "/settings/templates", label: "Message Templates" },
  { href: "/settings/calendar", label: "Google Calendar" },
];

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" />
      <main className="page max-w-2xl">
        <nav className="flex flex-col gap-2">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="card flex min-h-12 items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--color-sunken)]"
            >
              <span className="font-semibold">{s.label}</span>
              <span aria-hidden className="text-[var(--color-muted)]">
                ›
              </span>
            </Link>
          ))}
        </nav>

        <form action={signOut} className="mt-6">
          <button type="submit" className="btn w-full">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
