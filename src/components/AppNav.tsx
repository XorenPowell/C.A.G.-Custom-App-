"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Persistent navigation, lifted from the design mockup.
 *
 * Previously every screen only had a back link, so moving between Jobs and
 * Partnerships meant returning to Home first. On a 117-partnership book that
 * round trip happens constantly. Scrolls sideways rather than wrapping, so it
 * stays one line on a phone.
 */
const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/partnerships", label: "Partnerships" },
  { href: "/contacts", label: "Contacts" },
  { href: "/visits", label: "Visits" },
  { href: "/campaigns", label: "SAFC" },
  { href: "/cards", label: "Cards" },
  { href: "/roster", label: "Roster" },
  { href: "/face-to-face", label: "F2F" },
  { href: "/reports", label: "Reports" },
  { href: "/time-clock", label: "Clock" },
  { href: "/settings", label: "Settings" },
];

export default function AppNav() {
  const pathname = usePathname();

  // Longest matching prefix wins, so /partnerships/<id> lights Partnerships
  // without / lighting up on every page.
  const activeHref = ITEMS.reduce((best, item) => {
    const match = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    if (!match) return best;
    return item.href.length > best.length ? item.href : best;
  }, "");

  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Main"
      className="-mx-3 flex gap-1 overflow-x-auto px-3 md:mx-0 md:px-0 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ITEMS.map((item) => {
        const on = activeHref === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap ${
              on
                ? "bg-[var(--pill-active-bg)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
