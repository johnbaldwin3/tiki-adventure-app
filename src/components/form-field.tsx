// Labeled input with hint + error wiring (aria-invalid / aria-describedby).
// Plain component so both server pages and client forms can use it.

export const fieldClass =
  // border-teal on white is ~6:1, clearing WCAG 1.4.11's 3:1 for field outlines.
  "w-full rounded-xl border bg-card px-3 py-2.5 text-base text-ink shadow-sm focus:outline-2 focus:outline-offset-1 focus:outline-teal";

interface Props {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
  inputMode?: "text" | "email" | "decimal";
}

export function FormField({ id, label, type = "text", autoComplete, defaultValue, hint, error, inputMode }: Props) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={`mt-1.5 ${fieldClass} ${error ? "border-2 border-coral-deep" : "border-teal"}`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </div>
  );
}
