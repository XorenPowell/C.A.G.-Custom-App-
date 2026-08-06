import Link from "next/link";

/**
 * Plain GET form. No client JS, no state to desync — filters live in the URL,
 * so a filtered view is shareable and survives a refresh.
 */
export default function FilterBar({
  action,
  children,
  active,
}: {
  action: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <form method="get" action={action} className="card card-pad mb-3">
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          Apply
        </button>
        {active && (
          <Link href={action} className="btn btn-sm">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  value: string;
  options: { id: string; name: string }[];
  allLabel?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value} className="select">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterText({
  name,
  label,
  value,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}
