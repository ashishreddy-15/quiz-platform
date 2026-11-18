"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { Concept } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { conceptDepths, prettifyId, useQLabel } from "./hooks";
import { IconCheck, IconChevronDown, IconChevronRight, IconCircle, IconDot, IconFlag, IconHalf, IconX } from "./icons";
import { Md } from "./Md";

export type PathStatus = "solid" | "missed" | "start" | "untested" | "mastered" | "learning" | "needs_teacher";

const STATUS: Record<PathStatus, { label: string; cls: string }> = {
  solid: { label: "Solid", cls: "text-success" },
  missed: { label: "Missed", cls: "text-danger" },
  start: { label: "Start here", cls: "text-accent-text" },
  untested: { label: "Not tested", cls: "text-text-3" },
  mastered: { label: "Mastered", cls: "text-success" },
  learning: { label: "Learning", cls: "text-warning" },
  needs_teacher: { label: "Needs teacher", cls: "text-warning" },
};

function StatusIcon({ s, n }: { s: PathStatus; n?: number }) {
  const box = "relative z-10 grid h-6 w-6 place-items-center rounded-full";
  if (s === "start")
    return n ? (
      <span className={box + " bg-[var(--row-bg)]"}><span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-accent text-[11px] font-semibold tabular-nums text-white">{n}</span></span>
    ) : (
      <span className={clsx(box, "bg-[var(--row-bg)] text-accent-text")}><IconDot size={16} /></span>
    );
  return (
    <span className={clsx(box, "bg-[var(--row-bg)]", STATUS[s].cls)}>
      {s === "solid" || s === "mastered" ? <IconCheck size={15} /> : s === "missed" ? <IconX size={15} /> : s === "learning" ? <IconHalf size={14} /> : s === "needs_teacher" ? <IconFlag size={14} /> : <IconCircle size={14} />}
    </span>
  );
}

type Row = { c: Concept; status: PathStatus; qids: string[]; gapIndex: number; depth: number };

/** Concepts in prerequisite order with a status each. Shared by diagnosis, lesson and report. */
export function useLearningPath() {
  const pack = useSession((s) => s.pack);
  const diagnosis = useSession((s) => s.diagnosis);
  const graded = useSession((s) => s.graded);
  const questions = useSession((s) => s.questions);
  const progress = useSession((s) => s.progress);

  return useMemo(() => {
    const concepts: Concept[] = [...(pack?.concepts ?? [])];
    const gaps = diagnosis?.root_gaps ?? [];
    for (const g of gaps)
      if (!concepts.some((c) => c.id === g.concept_id))
        concepts.push({ id: g.concept_id, subject: pack?.subject ?? "", name: prettifyId(g.concept_id), description: "", prerequisites: [], grade: 0 });
    const depth = conceptDepths(concepts);
    const maxDepth = Math.max(0, ...depth.values());
    const wrong = new Set(graded.filter((g) => !g.correct).flatMap((g) => g.concepts));
    const right = new Set(graded.filter((g) => g.correct).flatMap((g) => g.concepts));
    const strengths = new Set(diagnosis?.strengths ?? []);
    const gapIdx = new Map(gaps.map((g, i) => [g.concept_id, i]));

    const rows: Row[] = concepts.map((c, i) => {
      const qids = questions.filter((q) => q.concepts.includes(c.id)).map((q) => q.id);
      const p = progress[c.id];
      const isGap = gapIdx.has(c.id);
      let status: PathStatus;
      if (isGap && p && p.status !== "gap" && p.status !== "unknown") status = p.status === "mastered" ? "mastered" : p.status === "needs_teacher" ? "needs_teacher" : "learning";
      else if (isGap) status = "start";
      else if (wrong.has(c.id)) status = "missed";
      else if (right.has(c.id) || strengths.has(c.id)) status = "solid";
      else status = "untested";
      return { c, status, qids, gapIndex: gapIdx.get(c.id) ?? -1, depth: depth.get(c.id) ?? 0, _i: i } as Row & { _i: number };
    });
    rows.sort((a, b) => a.depth - b.depth || (a as Row & { _i: number })._i - (b as Row & { _i: number })._i);

    const groupOf = (r: Row) => (r.depth === 0 ? "Foundations" : r.depth === maxDepth ? "Your topic" : "Builds on");
    const groups: { label: string; rows: Row[] }[] = [];
    for (const r of rows) {
      const label = maxDepth === 0 ? "Concepts" : groupOf(r);
      const g = groups.at(-1);
      if (g?.label === label) g.rows.push(r);
      else groups.push({ label, rows: [r] });
    }
    const counts = rows.reduce<Record<PathStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }),
      { solid: 0, missed: 0, start: 0, untested: 0, mastered: 0, learning: 0, needs_teacher: 0 });
    return { rows, groups, counts, gaps };
  }, [pack, diagnosis, graded, questions, progress]);
}

function PathRow({ r, multiGap, reasoning, current }: { r: Row; multiGap: boolean; reasoning?: string; current?: boolean }) {
  const [open, setOpen] = useState(false);
  const qLabel = useQLabel();
  const start = r.status === "start";
  const expandable = !!reasoning;
  const highlight = start || current;
  return (
    <li className={clsx("relative rounded-md", highlight && "bg-surface-2")}
      style={{ ["--row-bg" as string]: highlight ? "var(--gf-surface-2)" : "var(--gf-bg)" }}>
      {highlight && <span className="absolute inset-y-0 left-0 w-[2px] rounded-full bg-accent" />}
      <div role={expandable ? "button" : undefined} tabIndex={expandable ? 0 : undefined}
        onClick={() => expandable && setOpen((v) => !v)}
        onKeyDown={(e) => { if (expandable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen((v) => !v); } }}
        aria-expanded={expandable ? open : undefined}
        className={clsx("flex items-start gap-3 py-2.5 pl-2 pr-3", expandable && "cursor-pointer")}>
        <StatusIcon s={r.status} n={multiGap && start ? r.gapIndex + 1 : undefined} />
        <div className="min-w-0 flex-1 pt-[2px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={clsx("font-medium", r.status === "untested" ? "text-text-2" : "text-text")}>{r.c.name}</span>
            {expandable && (
              <span className="inline-flex items-center gap-0.5 text-[12px] text-text-3">
                {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />} Why
              </span>
            )}
          </div>
          {r.c.description && <p className="mt-0.5 text-[13px] leading-snug text-text-2">{r.c.description}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-[2px] sm:flex-row sm:items-center sm:gap-3">
          {r.qids.length > 0 && (
            <span className="hidden gap-1 sm:flex">
              {r.qids.map((q) => <span key={q} className="rounded border border-border px-1 text-[11px] tabular-nums leading-[16px] text-text-3">{qLabel(q)}</span>)}
            </span>
          )}
          <span className={clsx("whitespace-nowrap text-right text-[12px] font-medium sm:w-[92px]", STATUS[r.status].cls)}>
            {current && r.status === "learning" ? "In progress" : STATUS[r.status].label}
          </span>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && reasoning && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="pb-3 pl-11 pr-3 text-[13px] leading-relaxed text-text-2">
              <Label3>AI reasoning</Label3>
              <Md>{reasoning}</Md>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
const Label3 = ({ children }: { children: string }) => <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-text-3">{children}</div>;

export function LearningPath({ compact = false, defaultOpen = !compact }: { compact?: boolean; defaultOpen?: boolean }) {
  const { groups, counts, gaps } = useLearningPath();
  const currentGap = useSession((s) => s.currentGap);
  const [open, setOpen] = useState(defaultOpen);
  const reasoning = new Map(gaps.map((g) => [g.concept_id, g.reasoning]));

  const summary = [
    counts.solid + counts.mastered > 0 && `${counts.solid + counts.mastered} solid`,
    counts.start + counts.learning > 0 && `${counts.start + counts.learning} to learn`,
    counts.missed > 0 && `${counts.missed} missed`,
    counts.untested > 0 && `${counts.untested} not tested`,
  ].filter(Boolean).join(" · ");

  const list = (
    <div className="relative">
      <span className="pointer-events-none absolute bottom-5 left-[19.5px] top-5 w-px bg-border" aria-hidden />
      {groups.map((g) => (
        <div key={g.label} className="relative">
          <div className="relative z-10 py-2 pl-[44px] text-[11px] font-medium uppercase tracking-[0.06em] text-text-3">{g.label}</div>
          <ul className="space-y-0.5">
            {g.rows.map((r) => <PathRow key={r.c.id} r={r} multiGap={gaps.length > 1} reasoning={reasoning.get(r.c.id)} current={r.c.id === currentGap} />)}
          </ul>
        </div>
      ))}
    </div>
  );

  if (!compact) return list;
  return (
    <div className="rounded-lg border border-border">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {open ? <IconChevronDown size={14} className="text-text-3" /> : <IconChevronRight size={14} className="text-text-3" />}
        <span className="shrink-0 whitespace-nowrap font-medium">Your learning path</span>
        <span className="ml-auto min-w-0 truncate text-[13px] text-text-3">{summary}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.16 }} className="overflow-hidden">
            <div className="border-t border-border px-2 pb-2">{list}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
