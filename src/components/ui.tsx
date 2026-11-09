import type { ComponentProps, ReactNode } from "react";

// Small set of shared building blocks so every screen looks the same.

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Monochrome: the main action is the only white surface on the page.
const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-[#e4e4e4] shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_16px_-8px_rgb(0_0_0/0.8)]",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "border border-danger/25 bg-danger-soft text-danger hover:bg-danger/15",
};

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    BUTTON[variant],
    extra,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("glass rounded-xl border border-border p-5", className)} {...props} />;
}

const FIELD =
  "w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-text placeholder:text-faint focus:border-[#5a5a5a] focus:outline-none focus:ring-2 focus:ring-white/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(FIELD, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(FIELD, className)} {...props} />;
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block">
      <span className="text-sm font-medium text-text">{children}</span>
      {hint ? <span className="mt-0.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-8">
      {back ? <div className="mb-3">{back}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
          {description ? <p className="mt-1 max-w-xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const BADGE: Record<Tone, string> = {
  neutral: "border border-border-strong bg-surface-2 text-muted",
  ok: "border border-ok/20 bg-ok-soft text-ok",
  warn: "border border-border-strong bg-warn-soft text-warn",
  danger: "border border-danger/20 bg-danger-soft text-danger",
  accent: "border border-white/10 bg-accent-soft text-text",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-faint",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  accent: "bg-accent",
};

export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", BADGE[tone])}>
      {dot ? <span className={cx("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-lg px-4 py-3 text-sm", BADGE[tone], "font-normal")}>{children}</div>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cx("h-4 w-4 shrink-0 transition-transform", className)} aria-hidden>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Collapsible block for things only some users want: "Zaawansowane", "Szczegóły"… */
export function Disclosure({
  title,
  meta,
  children,
  defaultOpen,
  className,
  plain,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** No card frame — for use inside another card or form. */
  plain?: boolean;
}) {
  return (
    <details open={defaultOpen} className={cx("group", plain ? "" : "glass rounded-xl border border-border", className)}>
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-accent",
          plain ? "py-1 text-sm text-muted hover:text-text" : "px-5 py-4",
        )}
      >
        <span className="min-w-0 flex-1 font-medium">{title}</span>
        {meta ? <span className="text-xs text-faint">{meta}</span> : null}
        <Chevron className="text-muted group-open:rotate-180" />
      </summary>
      <div className={plain ? "pt-3" : "px-5 pb-5"}>{children}</div>
    </details>
  );
}
