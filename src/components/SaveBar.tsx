"use client";

/** Sticky save bar. Stays reachable with a thumb on a long mobile form. */
export default function SaveBar({
  onSave,
  pending,
  status,
  error,
  children,
  label = "Save",
}: {
  onSave: () => void;
  pending: boolean;
  status?: string | null;
  error?: string | null;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 md:px-6">
        <div className="min-w-0 flex-1 truncate text-sm">
          {error ? (
            <span className="font-semibold text-[var(--color-danger)]">{error}</span>
          ) : status ? (
            <span className="text-[var(--color-good)]">{status}</span>
          ) : null}
        </div>
        {children}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="btn btn-primary shrink-0"
        >
          {pending ? "Saving…" : label}
        </button>
      </div>
    </div>
  );
}
