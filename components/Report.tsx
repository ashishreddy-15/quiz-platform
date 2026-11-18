"use client";
import { useMemo } from "react";
import clsx from "clsx";
import { useSession, type MasteryStatus } from "@/lib/store";
import { conceptName, useConcepts } from "./hooks";
import { IconArrowRight, IconFlag, IconPlus, IconRefresh } from "./icons";
import { LearningPath } from "./LearningPath";
import { Button, Label, Page, SectionTitle } from "./ui";

const AFTER: Record<MasteryStatus, number> = { mastered: 1, learning: 0.5, needs_teacher: 0.3, gap: 0.2, unknown: 0.2 };

function Bar({ v, tone }: { v: number; tone: "before" | "after" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={clsx("h-full rounded-full", tone === "before" ? "bg-text-3" : v >= 0.8 ? "bg-success" : "bg-accent")} style={{ width: `${Math.max(0.04, v) * 100}%` }} />
    </div>
  );
}

export function Report() {
  const pack = useSession((s) => s.pack);
  const graded = useSession((s) => s.graded);
  const responses = useSession((s) => s.responses);
  const diagnosis = useSession((s) => s.diagnosis);
  const progress = useSession((s) => s.progress);
  const interest = useSession((s) => s.interest);
  const reset = useSession((s) => s.reset);
  const start = useSession((s) => s.start);
  const setPack = useSession((s) => s.setPack);
  const concepts = useConcepts();

  const stats = useMemo(() => {
    const tested = [...new Set(graded.flatMap((g) => g.concepts))];
    const wrongSet = new Set(graded.filter((g) => !g.correct).flatMap((g) => g.concepts));
    const gapIds = diagnosis?.root_gaps.map((g) => g.concept_id) ?? [];
    const solid = (id: string) => progress[id]?.status === "mastered" || (tested.includes(id) && !wrongSet.has(id));
    const rows = [...new Set([...gapIds, ...tested])].map((id) => {
      const before = wrongSet.has(id) || gapIds.includes(id) ? 0.2 : 1;
      let after = before;
      if (progress[id]) after = AFTER[progress[id].status];
      else if (wrongSet.has(id)) {
        const pre = concepts.find((c) => c.id === id)?.prerequisites ?? [];
        if (pre.length > 0 && pre.every(solid)) after = 0.7;
      }
      return { id, name: conceptName(concepts, id), before, after };
    }).sort((a, b) => (b.after - b.before) - (a.after - a.before));
    const flagged = Object.entries(progress).filter(([, p]) => p.status === "needs_teacher").map(([id]) => id);
    let next = concepts.filter((c) => !tested.includes(c.id) && !gapIds.includes(c.id) && c.prerequisites.length > 0 && c.prerequisites.every(solid));
    if (next.length === 0) next = concepts.filter((c) => !tested.includes(c.id) && !gapIds.includes(c.id));
    return { tested, rows, gapIds, flagged, next: next.slice(0, 4), mastered: gapIds.filter((id) => progress[id]?.status === "mastered").length };
  }, [graded, progress, diagnosis, concepts]);

  const totalMs = responses.reduce((a, r) => a + r.timeMs, 0);
  const time = totalMs < 60000 ? `${Math.max(1, Math.round(totalMs / 1000))}s` : `${Math.round(totalMs / 60000)} min`;
  const cells = [
    { label: "Concepts tested", value: String(stats.tested.length) },
    { label: "Gaps found", value: String(stats.gapIds.length) },
    { label: "Mastered", value: `${stats.mastered}/${stats.gapIds.length}` },
    { label: "Quiz time", value: time },
  ];

  const retake = () => { if (pack) { start(pack.subject, interest); setPack(pack); } };

  return (
    <Page>
      <Label>Report{pack ? ` · ${pack.topic}` : ""}</Label>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        {stats.gapIds.length === 0 ? "You're solid on this topic" : stats.mastered === stats.gapIds.length ? "Every gap closed" : "Here's where you landed"}
      </h1>
      <p className="mt-2 text-[15px] text-text-2">
        {stats.gapIds.length === 0 ? "No missing ideas found. Try a harder level or a related topic."
          : `You worked through ${stats.gapIds.length} ${stats.gapIds.length === 1 ? "idea" : "ideas"} underneath your mistakes.`}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="bg-bg px-4 py-3.5">
            <div className="text-[12px] text-text-3">{c.label}</div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums tracking-[-0.01em]">{c.value}</div>
          </div>
        ))}
      </div>

      {stats.rows.length > 0 && (
        <section className="mt-12">
          <SectionTitle aside={<span className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-text-3" />Before</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-success" />After</span></span>}>
            Before → after
          </SectionTitle>
          <ul className="overflow-hidden rounded-lg border border-border">
            {stats.rows.map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-2 border-t border-border px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_76px] sm:items-center sm:gap-4">
                <span className="truncate font-medium">{r.name}</span>
                <div className="space-y-1.5"><Bar v={r.before} tone="before" /><Bar v={r.after} tone="after" /></div>
                <span className="text-[13px] tabular-nums text-text-2 sm:text-right">{Math.round(r.before * 100)} → <span className="text-text">{Math.round(r.after * 100)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <SectionTitle aside="Foundations first">Your learning path</SectionTitle>
        <LearningPath />
      </section>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <section>
          <SectionTitle>Flagged for teacher</SectionTitle>
          {stats.flagged.length === 0 ? <p className="text-text-3">Nothing flagged.</p> : (
            <ul className="space-y-1.5">
              {stats.flagged.map((id) => <li key={id} className="flex items-center gap-2"><IconFlag className="text-warning" />{conceptName(concepts, id)}</li>)}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle>Recommended next</SectionTitle>
          {stats.next.length === 0 ? <p className="text-text-3">Try a new topic to keep going.</p> : (
            <ul className="space-y-1.5">
              {stats.next.map((c) => <li key={c.id} className="flex items-center gap-2"><IconArrowRight className="text-text-3" />{c.name}</li>)}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-6">
        <Button size="lg" onClick={reset}><IconPlus /> New topic</Button>
        {pack && <Button size="lg" variant="secondary" onClick={retake}><IconRefresh /> Retake quiz</Button>}
      </div>
    </Page>
  );
}
