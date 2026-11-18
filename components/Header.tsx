"use client";
import clsx from "clsx";
import { useSession, type Phase } from "@/lib/store";

const STEPS = ["Quiz", "Diagnose", "Learn", "Master", "Report"] as const;
const STEP_OF: Record<Phase, number> = { pick: -1, quiz: 0, diagnosing: 1, diagnosis: 1, lesson: 2, mastery: 3, teachback: 3, report: 4 };
const ICON = { math: "∑", physics: "⚛", chemistry: "⚗" } as const;

export function Header() {
  const phase = useSession((s) => s.phase);
  const subject = useSession((s) => s.subject);
  const reset = useSession((s) => s.reset);
  const cur = STEP_OF[phase];
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">G</span>
          <span className="text-lg font-bold tracking-tight">GapFinder</span>
        </div>
        {subject && (
          <span className="hidden rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium capitalize text-indigo-200 sm:inline">
            {ICON[subject]} {subject}
          </span>
        )}
        <ol className="ml-auto hidden items-center gap-1 text-xs md:flex">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span className={clsx("rounded-full px-2.5 py-1 font-medium transition",
                i === cur ? "bg-indigo-500 text-white" : i < cur ? "bg-emerald-500/15 text-emerald-300" : "text-slate-500")}>
                {i < cur ? "✓ " : ""}{s}
              </span>
              {i < STEPS.length - 1 && <span className="text-slate-700">›</span>}
            </li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-2 md:ml-3">
          <span className="text-xs text-slate-400 md:hidden">{cur >= 0 ? STEPS[cur] : ""}</span>
          {phase !== "pick" && (
            <button onClick={() => { if (confirm("Start over? Your progress will be cleared.")) reset(); }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800" title="Reset session">
              ↺ Reset
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
