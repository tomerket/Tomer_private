import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type Result = { ok: true } | { ok: false; error: string } | null;

const fieldBase =
  "w-full border border-line bg-surface text-[15px] text-fg placeholder:text-fg-faint transition-colors hover:border-line-strong focus:border-accent focus:outline-none";

/** Single-line fields are pills, like the reference search field. */
export const inputClass = `${fieldBase} rounded-[var(--radius-pill)] px-4 py-2.5`;
const textareaClass = `${fieldBase} rounded-[var(--radius-control)] px-4 py-3`;

export type ButtonVariant = "primary" | "strong" | "outline" | "ghost";

/**
 * Pill buttons. Amber `primary` is used on exactly one action per view.
 * `strong` is solid white for a confident secondary; `outline` shows a settled
 * state (e.g. Published); `ghost` is for minor actions.
 */
export function buttonClass(variant: ButtonVariant = "primary") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] px-4 h-10 text-[14px] font-semibold tracking-[-0.006em] transition-[background-color,border-color,color,filter] disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-on-accent hover:brightness-110",
    strong: "bg-fg text-canvas hover:bg-white",
    outline: "border border-line-strong text-fg hover:border-fg-faint",
    ghost: "bg-surface text-fg-muted hover:bg-raised hover:text-fg",
  };
  return `${base} ${variants[variant]}`;
}

export function TextField({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? props.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
    </div>
  );
}

export function TextArea({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id ?? props.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea id={id} className={`${textareaClass} min-h-32 resize-y leading-relaxed`} {...props} />
    </div>
  );
}

export function PrimaryButton({ pending, children }: { pending?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {children}
    </button>
  );
}

export function FormError({ state }: { state: Result }) {
  if (!state || state.ok) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {state.error}
    </p>
  );
}

export function SavedNote({ state, children = "Saved" }: { state: Result; children?: ReactNode }) {
  if (!state?.ok) return null;
  return (
    <p role="status" className="text-sm text-fg-muted">
      {children}
    </p>
  );
}

/** An accessible on/off switch. The accent state means "live". */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-wait disabled:opacity-60 ${
        checked ? "border-accent bg-accent" : "border-line bg-raised"
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full transition-transform ${
          checked ? "translate-x-[19px] bg-on-accent" : "translate-x-[3px] bg-fg-muted"
        }`}
      />
    </button>
  );
}
