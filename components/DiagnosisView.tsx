"use client";
import { useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { DiagnoseRes } from "@/lib/api-contract";
import type { GradedResponse } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { conceptName, joinAnd, useConcepts, useQLabel } from "./hooks";
import { IconArrowRight, IconCheckCircle, IconChevronDown, IconChevronRight } from "./icons";
import { LearningPath } from "./LearningPath";
import { Md } from "./Md";
import { Badge, Button, Label, Page, SectionTitle, type Tone } from "./ui";

type PQ = DiagnoseRes["per_question"][number];
const ERR: Record<PQ["error_type"], { label: string; tone: Tone }> = {
  misconception: { label: "Misconception", tone: "danger" },
  slip: { label: "Slip", tone: "warning" },
  guess: { label: "Guess", tone: "neutral" },
  correct: { label: "Correct", tone: "success" },
};

function QuestionRow({ g, pq, label }: { g: GradedResponse; pq?: PQ; label: string }) {
  const [open, setOpen] = useState(false);
  const et = pq?.error_type ?? (g.correct ? "correct" : "misconception");
  const detail = !g.correct && (pq?.misconception || pq?.evidence);
  return (
    <li className="border-t border-border first:border-t-0">
      <button onClick={() => detail && setOpen((v) => !v)} aria-expanded={detail ? open : undefined}
        className={clsx("grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-3 py-2.5 text-left sm:grid-cols-[28px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_136px] sm:items-center",
          detail ? "cursor-pointer hover:bg-surface-2" : "cursor-default")}>
        <span className="text-[13px] tabular-nums text-text-3">{label}</span>
        <span className="md-inline min-w-0 text-text sm:truncate"><Md>{g.stem}</Md></span>
        <span className="col-span-2 col-start-2 row-start-2 min-w-0 text-[13px] sm:col-span-1 sm:truncate sm:col-start-auto sm:row-start-auto">
          <span className="text-text-3 sm:hidden">You: </span>
          <span className={clsx("md-inline", g.correct ? "text-text-2" : "text-danger")}><Md>{g.chosenText}</Md></span>
        </span>
        <span className="col-span-2 col-start-2 row-start-3 min-w-0 text-[13px] text-text-2 sm:col-span-1 sm:truncate sm:col-start-auto sm:row-start-auto">
          <span className="text-text-3 sm:hidden">Correct: </span>
          <span className="md-inline"><Md>{g.correctText}</Md></span>
        </span>
        <span className="col-start-3 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-auto sm:row-start-auto">
          <Badge tone={ERR[et].tone} dot>{ERR[et].label}</Badge>
          <span className={clsx("w-3 text-text-3", !detail && "invisible")}>{open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && detail && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="space-y-1 pb-3 pl-[52px] pr-3 text-[13px]">
              {pq?.misconception && <p className="text-text">{pq.misconception}</p>}
              {pq?.evidence && <p className="text-text-3">{pq.evidence}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function ConfidenceGrid({ graded, label }: { graded: GradedResponse[]; label: (q: string) => string }) {
  const sure = (g: GradedResponse) => g.confidence >= 0.55;
  const cells = [
    { title: "Sure but wrong", sub: "Likely misconception", tone: "text-danger", qs: graded.filter((g) => !g.correct && sure(g)) },
    { title: "Unsure and wrong", sub: "Gap in knowledge", tone: "text-warning", qs: graded.filter((g) => !g.correct && !sure(g)) },
    { title: "Unsure but right", sub: "Shaky — worth a review", tone: "text-text-2", qs: graded.filter((g) => g.correct && !sure(g)) },
    { title: "Sure and right", sub: "Solid", tone: "text-success", qs: graded.filter((g) => g.correct && sure(g)) },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {cells.map((c) => (
        <div key={c.title} className="bg-bg p-4">
          <div className="flex items-baseline gap-2">
            <span className={clsx("text-[20px] font-semibold tabular-nums", c.qs.length ? c.tone : "text-text-3")}>{c.qs.length}</span>
            <span className="text-[13px] font-medium text-text">{c.title}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-text-3">{c.sub}</div>
          <div className="mt-2 flex min-h-5 flex-wrap gap-1">
            {c.qs.map((g) => <span key={g.qid} className="rounded border border-border px-1 text-[11px] tabular-nums leading-[16px] text-text-2">{label(g.qid)}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiagnosisView() {
  const diagnosis = useSession((s) => s.diagnosis);
  const graded = useSession((s) => s.graded);
  const gapQueue = useSession((s) => s.gapQueue);
  const progress = useSession((s) => s.progress);
  const beginGap = useSession((s) => s.beginGap);
  const setPhase = useSession((s) => s.setPhase);
  const concepts = useConcepts();
  const qLabel = useQLabel();
  if (!diagnosis) return null;

  const gaps = diagnosis.root_gaps;
  const next = gapQueue[0];
  const noGaps = gaps.length === 0;
  const resumed = gaps.length > 0 && gapQueue.length < gaps.length;
  const wrong = graded.filter((g) => !g.correct);
  const wrongIds = new Set(wrong.map((g) => g.qid));
  const firstGap = gaps[0];

  let headline: React.ReactNode;
  let summary: string | undefined;
  if (noGaps) {
    headline = wrong.length === 0 ? "You're solid on this topic." : "No deeper gap found.";
    summary = wrong.length === 0
      ? `All ${graded.length} answers were correct. Your report shows what to explore next.`
      : "Your misses look like one-off slips rather than a missing idea.";
  } else if (resumed && next) {
    const doneN = gaps.length - gapQueue.length;
    headline = <>{doneN} of {gaps.length} ideas done. Next up: <span className="text-accent-text">{conceptName(concepts, next)}</span>.</>;
    summary = gaps.find((g) => g.concept_id === next)?.student_facing_summary;
  } else if (gaps.length === 1) {
    const qs = firstGap.explains_qids.filter((q) => wrongIds.has(q)).map(qLabel);
    const shown = qs.length ? qs : wrong.map((g) => qLabel(g.qid));
    const plural = shown.length > 1;
    headline = <>Your {plural ? "mistakes" : "mistake"} on {joinAnd(shown)} {plural ? "come" : "comes"} from one idea: <span className="text-accent-text">{conceptName(concepts, firstGap.concept_id)}</span>.</>;
    summary = firstGap.student_facing_summary;
  } else {
    headline = <>Your mistakes trace back to {gaps.length} ideas: {gaps.map((g, i) => (
      <span key={g.concept_id}>{i > 0 && (i === gaps.length - 1 ? " and " : ", ")}<span className="text-accent-text">{conceptName(concepts, g.concept_id)}</span></span>
    ))}.</>;
    summary = firstGap.student_facing_summary;
  }

  return (
    <Page>
      <div className="flex items-center gap-2">
        <Label>Diagnosis</Label>
        <span className="text-[12px] text-text-3">· {graded.length - wrong.length} of {graded.length} correct</span>
        {diagnosis.fallback && <Badge className="ml-auto">Offline analysis</Badge>}
      </div>
      {noGaps && <IconCheckCircle size={28} className="mt-5 text-success" />}
      <h1 className="mt-3 text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] sm:text-[28px]">{headline}</h1>
      {summary && <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-text-2">{summary}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {next ? (
          <Button size="lg" onClick={() => beginGap(next)}>{resumed ? "Continue" : "Start lesson"} <IconArrowRight /></Button>
        ) : (
          <Button size="lg" onClick={() => setPhase("report")}>See my report <IconArrowRight /></Button>
        )}
        {next && <span className="text-[13px] text-text-3">About 3 minutes · then 3 quick check questions</span>}
      </div>

      <section className="mt-14">
        <SectionTitle aside="Foundations first">Your learning path</SectionTitle>
        <LearningPath />
      </section>

      <section className="mt-12">
        <SectionTitle aside={`${wrong.length} to review`}>Question by question</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[28px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_136px] gap-x-3 border-b border-border bg-surface px-3 py-2 text-[12px] text-text-3 sm:grid">
            <span>#</span><span>Question</span><span>Your answer</span><span>Correct answer</span><span className="pr-[18px] text-right">Type</span>
          </div>
          <ul>
            {graded.map((g) => <QuestionRow key={g.qid} g={g} label={qLabel(g.qid)} pq={diagnosis.per_question.find((p) => p.qid === g.qid)} />)}
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle aside="How sure you were vs. how you did">Confidence check</SectionTitle>
        <ConfidenceGrid graded={graded} label={qLabel} />
      </section>

      {Object.values(progress).some((p) => p.status === "needs_teacher") && (
        <p className="mt-8 text-[13px] text-text-3">Concepts marked “Needs teacher” are saved to your report.</p>
      )}
    </Page>
  );
}
