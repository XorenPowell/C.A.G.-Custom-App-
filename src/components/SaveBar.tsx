"use client";

/**
 * Floating save control.
 *
 * This was a full-width band pinned to the bottom, which spent the whole
 * viewport width on one button and covered a row of whatever was underneath.
 * Now it floats bottom-right, and the status rides beside it as a chip
 * instead of claiming its own column.
 */
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
  const message = error ?? status ?? null;

  return (
    // pointer-events-none on the wrapper so the page stays clickable
    // everywhere the controls themselves are not.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end px-3 pb-3 md:px-6 md:pb-5">
      <div className="pointer-events-auto flex items-center gap-2">
        {message && (
          <span
            className={`rounded-[var(--radius-btn)] border px-2.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur ${
              error
                ? "border-[var(--color-danger)] bg-[var(--panel)] text-[var(--color-danger)]"
                : "border-[var(--color-good)] bg-[var(--panel)] text-[var(--color-good)]"
            }`}
          >
            {message}
          </span>
        )}

        {children}

        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="btn btn-primary shadow-lg"
        >
          {pending ? "Saving…" : label}
        </button>
      </div>
    </div>
  );
}
