"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppNav from "@/components/AppNav";
import { signOut } from "@/app/actions/auth";

/** Brand, persistent nav and sign-out. Rendered once by the root layout. */
export default function AppHeader() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-2 md:px-6">
        <Link
          href="/"
          className="font-heading shrink-0 text-[13px] font-bold tracking-[1px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          C.A.G.
        </Link>
        <AppNav />
        <form action={signOut} className="ml-auto shrink-0">
          <button type="submit" className="btn btn-sm">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
