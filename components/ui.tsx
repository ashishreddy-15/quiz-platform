"use client";
import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { IconAlert, IconCheck, IconCircle, IconRefresh, IconX, Spinner } from "./icons";
import { Md } from "./Md";

/** One centered content column. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("mx-auto w-full max-w-[720px] px-4 pb-24 pt-10 sm:pt-14", className)}>{children}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};
export function Button({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "h-7 px-2.5 text-[13px]",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "lg" && "h-10 px-4 text-[14px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover disabled:hover:bg-accent",
        variant === "secondary" && "border border-border-strong bg-surface text-text hover:bg-surface-2",
        variant === "ghost" && "text-text-2 hover:bg-surface-2 hover:text-text",
        className,
      )}
    />
  );
}

export type Tone = "neutral" | "accent" | "success" | "danger" | "warning";
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-text-2",
  accent: "text-accent-text",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
};
export function Badge({ children, tone = "neutral", className, dot }: { children: ReactNode; tone?: Tone; className?: string; dot?: boolean }) {
  return (
    <span className={clsx("inline-flex h-5 shrink-0 items-center gap-1.5 rounded border border-border bg-surface px-1.5 text-[12px] font-medium leading-none", TONE_TEXT[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("text-[12px] font-medium uppercase tracking-[0.06em] text-text-3", className)}>{children}</div>;
}

export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={clsx("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[16px] font-semibold">{children}</h2>
      {aside && <div className="hidden text-[13px] text-text-3 sm:block">{aside}</div>}
    </div>
  );
}

export function ProgressBar({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "success" | "muted" }) {
  return (
    <div className={clsx("h-1 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className={clsx("h-full rounded-full transition-[width] duration-300 ease-out", tone === "accent" && "bg-accent", tone === "success" && "bg-success", tone === "muted" && "bg-text-3")}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function ErrorBox({ message, onRetry, children }: { message: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <IconAlert className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-0.5 break-words text-text-2">{message}</p>
          {(onRetry || children) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onRetry && <Button variant="secondary" onClick={onRetry}><IconRefresh /> Retry</Button>}
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A calm progress checklist: steps tick over time; the last one waits for `done`. */
export function Checklist({ steps, stepMs = 2500, done = false }: { steps: string[]; stepMs?: number; done?: boolean }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (done) return;
    if (active >= steps.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), stepMs);
    return () => clearTimeout(t);
  }, [active, done, stepMs, steps.length]);
  const cur = done ? steps.length : active;
  return (
    <ol className="space-y-3" aria-live="polite">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3">
          <span className={clsx("grid h-4 w-4 place-items-center", i < cur ? "text-success" : i === cur ? "text-accent-text" : "text-text-3")}>
            {i < cur ? <IconCheck /> : i === cur ? <Spinner /> : <IconCircle />}
          </span>
          <span className={clsx("transition-colors duration-150", i < cur ? "text-text-2" : i === cur ? "text-text" : "text-text-3")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label, className }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("grid rounded-md border border-border bg-surface p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={clsx("h-7 truncate rounded-[5px] px-2 text-[13px] font-medium transition-colors duration-150",
              on ? "bg-surface-3 text-text shadow-[0_0_0_1px_var(--gf-border-strong)]" : "text-text-2 hover:text-text")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dim";
/** Full-width answer row, used by the quiz and mastery check. */
export function OptionRow({ letter, text, state, onClick, disabled }: { letter: string; text: string; state: OptionState; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx("group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[15px] transition-colors duration-150",
        state === "idle" && "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
        state === "selected" && "border-accent bg-accent/10",
        state === "correct" && "border-success/60 bg-success/10",
        state === "wrong" && "border-danger/60 bg-danger/10",
        state === "dim" && "border-border bg-surface opacity-55",
        disabled && "cursor-default")}>
      <kbd className={clsx("!h-5 !min-w-5 shrink-0", state === "selected" && "!border-accent !bg-accent !text-white")}>{letter}</kbd>
      <span className="md-inline min-w-0 flex-1 break-words"><Md>{text}</Md></span>
      {state === "correct" && <IconCheck className="shrink-0 text-success" />}
      {state === "wrong" && <IconX className="shrink-0 text-danger" />}
    </button>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={clsx("border-0 border-t border-border", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded-md bg-surface-2", className)} />;
}
