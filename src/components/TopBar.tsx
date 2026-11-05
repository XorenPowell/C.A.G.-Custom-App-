import Link from "next/link";

/**
 * A screen's own title row. Navigation lives in the layout now, so this
 * only handles returning to a list from a record — a different movement
 * to switching section.
 */
export default function TopBar({
  title,
  back = "/",
  backLabel = "Home",
  action,
}: {
  title: string;
  back?: string | null;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-3 pt-3 md:px-6">
      <div className="flex items-center gap-2">
        {back && back !== "/" && (
          <Link href={back} className="btn btn-sm shrink-0">
            ‹ {backLabel}
          </Link>
        )}
        <h1 className="h2 min-w-0 flex-1 truncate">{title}</h1>
        {action}
      </div>
    </div>
  );
}
