import Link from "next/link";
import { signOut } from "@/app/actions/auth";

/**
 * Compact header. Every screen other than the menu gets a back link, so the
 * menu is always one tap away on a phone.
 */
export default function TopBar({
  title,
  back = "/",
  backLabel = "Menu",
  action,
}: {
  title: string;
  back?: string | null;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 md:px-6">
        {back && (
          <Link href={back} className="btn btn-sm shrink-0">
            ‹ {backLabel}
          </Link>
        )}
        <h1 className="h2 min-w-0 flex-1 truncate">{title}</h1>
        {action}
        {!back && (
          <form action={signOut}>
            <button type="submit" className="btn btn-sm">
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
