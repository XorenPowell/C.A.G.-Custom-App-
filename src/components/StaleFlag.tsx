import { daysSince, isAvailabilityStale, STALE_AVAILABILITY_DAYS } from "@/lib/format";

/**
 * Red flag shown anywhere an entity appears when its availability has not been
 * touched in more than 6 days (spec 3.1).
 */
export default function StaleFlag({ updatedAt }: { updatedAt: string | null }) {
  if (!isAvailabilityStale(updatedAt)) return null;

  const days = daysSince(updatedAt);
  const label =
    days === null
      ? "Availability never set"
      : `Availability ${days}d old`;

  return (
    <span
      className="badge border-[var(--color-danger)] bg-red-50 text-[var(--color-danger)]"
      title={`Availability has not been updated in more than ${STALE_AVAILABILITY_DAYS} days.`}
    >
      ⚑ {label}
    </span>
  );
}
