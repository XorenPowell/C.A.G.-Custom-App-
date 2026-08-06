"use client";

import { useId } from "react";

/* Small form primitives. Deliberately thin — they only handle the
   label/spacing boilerplate so screens stay readable. */

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

type BaseProps = {
  label?: string;
  hint?: string;
  className?: string;
};

export function TextInput({
  label,
  hint,
  className,
  ...rest
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} className={className}>
      <input id={id} className="input" {...rest} />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  className,
  ...rest
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea className="textarea" {...rest} />
    </Field>
  );
}

export function Select({
  label,
  hint,
  className,
  children,
  ...rest
}: BaseProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className="select" {...rest}>
        {children}
      </select>
    </Field>
  );
}

/** Numeric input tuned for currency entry on a phone keypad. */
export function MoneyInput({
  label,
  hint,
  className,
  ...rest
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex items-center border border-[var(--color-line)] bg-white focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accent)]">
        <span className="px-2 text-[var(--color-muted)]">$</span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          className="w-full border-0 bg-transparent px-0 py-2 pr-2 outline-none"
          {...rest}
        />
      </div>
    </Field>
  );
}

export function NumberInput({
  label,
  hint,
  className,
  ...rest
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input type="number" inputMode="decimal" className="input" {...rest} />
    </Field>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-[var(--color-accent)]"
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

/** Wrapper for one row of any repeating structure, with its remove control. */
export function RepeatRow({
  children,
  onRemove,
  title,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  title?: string;
}) {
  return (
    <div className="row-repeat mb-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
          {title}
        </span>
        <button type="button" onClick={onRemove} className="btn btn-sm btn-danger">
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="btn btn-sm">
      + {children}
    </button>
  );
}

/** A bordered, titled block. Used to group sections on the long detail forms. */
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="card mb-3">
      <div className="section-title flex items-center justify-between gap-2">
        <span>{title}</span>
        {action}
      </div>
      <div className="card-pad">{children}</div>
    </section>
  );
}
