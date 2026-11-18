"use client";
import clsx from "clsx";
import { useSession, type Phase } from "@/lib/store";
import { IconCheck, IconChevronRight } from "./icons";

const STEPS = ["Topic", "Quiz", "Diagnosis", "Lesson", "Check", "Report"] as const;
const STEP_OF: Record<Phase, number> = { pick: 0, quiz: 1, diagnosing: 2, diagnosis: 2, lesson: 3, mastery: 4, teachback: 4, report: 5 };

export function TopBar() {
  const phase = useSession((s) => s.phase);
  const topic = useSession((s) => s.pack?.topic);
  const reset = useSession((s) => s.reset);
  const cur = STEP_OF[phase];

  const newTopic = () => {
    if (phase === "pick" || phase === "report" || confirm("Start a new topic? Your progress on this one will be cleared.")) reset();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg">
      <div className="mx-auto flex h-12 max-w-[1120px] items-center gap-3 px-4">
        <button onClick={newTopic} className="flex shrink-0 items-center gap-2 rounded-md text-[14px] font-semibold tracking-[-0.01em]" title="New topic">
          <span className="grid h-[18px] w-[18px] place-items-center rounded-[4px] bg-accent">
            <span className="h-[6px] w-[6px] rounded-[1.5px] bg-white" />
          </span>
          GapFinder
        </button>
        {topic && phase !== "pick" && (
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-text-2">
            <IconChevronRight size={14} className="shrink-0 text-text-3" />
            <span className="truncate" title={topic}>{topic}</span>
          </div>
        )}

        <ol className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-0.5">
              <span aria-current={i === cur ? "step" : undefined}
                className={clsx("flex h-6 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium",
                  i === cur && "bg-surface-2 text-text shadow-[inset_0_0_0_1px_var(--gf-border)]",
                  i < cur && "text-text-2",
                  i > cur && "text-text-3")}>
                {i < cur ? <IconCheck size={13} className="text-success" /> : <span className={clsx("text-[12px] tabular-nums", i === cur ? "text-accent-text" : "text-text-3")}>{i + 1}</span>}
                {s}
              </span>
              {i < STEPS.length - 1 && <IconChevronRight size={12} className="text-text-3/70" />}
            </li>
          ))}
        </ol>

        <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-2">
          <span className="text-[13px] text-text-2 lg:hidden">
            <span className="tabular-nums text-text-3">{cur + 1}/{STEPS.length}</span> {STEPS[cur]}
          </span>
          {phase !== "pick" && (
            <button onClick={newTopic} className="hidden h-7 items-center rounded-md border border-border px-2.5 text-[13px] text-text-2 transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex">
              New topic
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
