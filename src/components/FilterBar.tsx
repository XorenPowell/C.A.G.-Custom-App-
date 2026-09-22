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
  hideBlankOption = false,
}: {
  name: string;
  label: string;
  value: string;
  options: { id: string; name: string }[];
  allLabel?: string;
  /** Set when the field always resolves to one of `options` — never a blank/"all" state. */
  hideBlankOption?: boolean;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value} className="select">
        {!hideBlankOption && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterCheckbox({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <div className="field flex items-end">
      <label className="flex items-center gap-1.5 pb-2 text-sm">
        {/* An unchecked box submits nothing, so a default-on checkbox
            couldn't otherwise tell "explicitly unchecked" from "form never
            submitted." This marker (a distinct name — Next.js turns a
            repeated query key into an array, not "last wins") is always
            present once the form is submitted, checked or not. */}
        <input type="hidden" name={`${name}Submitted`} value="1" />
        <input
          type="checkbox"
          name={name}
          value="1"
          defaultChecked={checked}
          className="size-4 accent-[var(--color-accent)]"
        />
        {label}
      </label>
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
