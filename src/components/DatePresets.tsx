"use client";

/**
 * The quick-pick gaps for booking a next action.
 *
 * One component in three places — the next-action card, Log contact and
 * Planned actions — because they had already drifted apart once, offering
 * different sets of days for the same decision. The offsets come from
 * Settings, so changing them changes every screen at once.
 */

/** Days -> button text. Round numbers read as words; everything else is "+Nd". */
export function presetLabel(days: number): string {
  if (days === 1) return "Tomorrow";
  if (days === 7) return "+1 week";
  if (days === 14) return "+2 weeks";
  if (days === 30) return "+1 month";
  if (days === 90) return "+3 months";
  if (days === 365) return "+1 year";
  return `+${days}d`;
}

/** Used when a caller has no settings to hand. Matches the column default. */
export const DEFAULT_PRESETS = [1, 3, 7, 30];

export default function DatePresets({
  presets,
  onPick,
  disabled,
}: {
  presets: number[];
  /** Days from today. The caller decides what time of day that lands on. */
  onPick: (days: number) => void;
  disabled?: boolean;
}) {
  const days = presets.length > 0 ? presets : DEFAULT_PRESETS;
  return (
    <>
      {days.map((d) => (
        <button
          key={d}
          type="button"
          className="btn btn-sm"
          disabled={disabled}
          onClick={() => onPick(d)}
        >
          {presetLabel(d)}
        </button>
      ))}
    </>
  );
}
