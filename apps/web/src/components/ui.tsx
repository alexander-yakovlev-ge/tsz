import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/** Общие стили элементов форм и кнопок (вариант оформления C). */
export const buttonClass = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 py-2.5 font-bold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-2.5 font-bold text-ink hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60',
  danger:
    'inline-flex min-h-11 items-center justify-center rounded-full bg-red-700 px-6 py-2.5 font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60',
};

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{children}</h1>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  const style =
    kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 ${style}`}
    >
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClass =
  'min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base text-ink focus:border-accent focus:outline-2 focus:outline-accent/30 aria-[invalid=true]:border-red-600 disabled:bg-gray-100';

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  id,
  label,
  hint,
  error,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  options,
  ...props
}: FieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    id: string;
    options: { value: string; label: string }[];
  }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={id}
        rows={6}
        className={`${controlClass} leading-relaxed`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldShell>
  );
}

export function CheckboxField({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-accent"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-gray-600">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Группа полей с заголовком — например, переводы на один язык. */
export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4">
      <legend className="px-1 font-bold">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Метка-статус: опубликовано, запланировано, доступ к документу. */
export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: 'gray' | 'accent' | 'amber' | 'red';
  children: ReactNode;
}) {
  const style = {
    gray: 'bg-gray-100 text-gray-700',
    accent: 'bg-accent/10 text-accent-strong',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-800',
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${style}`}
    >
      {children}
    </span>
  );
}

export function FormStatusAlert({
  status,
}: {
  status: { kind: 'error' | 'success'; text: string } | null;
}) {
  return status ? <Alert kind={status.kind}>{status.text}</Alert> : null;
}
