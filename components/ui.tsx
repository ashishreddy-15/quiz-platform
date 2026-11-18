"use client";
import clsx from "clsx";
import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

export function Card({ className, children, ...rest }: HTMLMotionProps<"div"> & { children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={clsx("glass rounded-2xl p-5 sm:p-6", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "success" | "danger" };
export function Button({ variant = "primary", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:brightness-110",
        variant === "success" && "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110",
        variant === "danger" && "bg-rose-500/90 text-white hover:bg-rose-500",
        variant === "ghost" && "border border-slate-600/70 bg-slate-800/40 text-slate-200 hover:bg-slate-700/60",
        className,
      )}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-slate-700/40", className)} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-rose-100">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 text-sm text-rose-200/80">{message}</p>
      {onRetry && <Button variant="ghost" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Badge({ children, tone = "slate", className }: { children: ReactNode; tone?: "slate" | "rose" | "amber" | "emerald" | "indigo" | "violet"; className?: string }) {
  const tones = {
    slate: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  };
  return <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}
