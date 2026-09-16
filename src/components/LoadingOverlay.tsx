"use client";

/**
 * Full-screen scrim + spinner. Deliberately plain white/gray, not the app's
 * dark theme tokens — it needs to read clearly regardless of which theme
 * (or Appearance override) is active underneath it.
 */
export default function LoadingOverlay({
  timedOut = false,
  actionLabel = "Dismiss",
  onAction,
}: {
  timedOut?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-[1px]"
    >
      {timedOut ? (
        <div className="mx-4 max-w-xs border border-gray-300 bg-white p-4 text-center shadow-lg">
          <p className="mb-1 text-sm font-semibold text-gray-900">
            This is taking longer than expected.
          </p>
          <p className="mb-3 text-xs text-gray-500">Check your connection and try again.</p>
          {onAction && (
            <button
              type="button"
              onClick={onAction}
              className="border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              {actionLabel}
            </button>
          )}
        </div>
      ) : (
        <div
          aria-hidden
          className="size-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700"
        />
      )}
    </div>
  );
}
