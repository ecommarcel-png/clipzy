import type { ComponentProps, ReactNode } from "react";

// Small set of shared building blocks so every screen looks the same.

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Text on orange is ink, never white (brand guide: 5.9:1 vs 3.1:1).
const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent font-bold hover:bg-accent-strong shadow-[0_8px_24px_-10px_rgb(255_90_31/0.7)]",
  secondary: "bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:brightness-125",
};

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
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
  return <div className={cx("glass rounded-[22px] border border-border p-6", className)} {...props} />;
}

const FIELD =
  "w-full rounded-xl border border-border bg-bg/70 px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

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
      <span className="text-sm font-bold text-text">{children}</span>
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
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {description ? <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const BADGE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
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
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", BADGE[tone])}>
      {dot ? <span className={cx("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-xl px-4 py-3 text-sm", BADGE[tone], "font-normal")}>{children}</div>;
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
    <details open={defaultOpen} className={cx("group", plain ? "" : "glass rounded-[22px] border border-border", className)}>
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center gap-3 rounded-[22px] focus-visible:outline-2 focus-visible:outline-accent",
          plain ? "py-1 text-sm text-muted hover:text-text" : "px-6 py-4",
        )}
      >
        <span className={cx("min-w-0 flex-1", plain ? "font-semibold" : "font-bold")}>{title}</span>
        {meta ? <span className="text-xs text-faint">{meta}</span> : null}
        <Chevron className="text-muted group-open:rotate-180" />
      </summary>
      <div className={plain ? "pt-3" : "px-6 pb-6"}>{children}</div>
    </details>
  );
}
