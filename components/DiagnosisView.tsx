"use client";
import { useState } from "react";
import { useSession } from "@/lib/store";
import { ConceptGraph } from "./ConceptGraph";
import { ConfidenceQuadrant } from "./ConfidenceQuadrant";
import { conceptName, useGraph } from "./hooks";
import { Badge, Button, Card } from "./ui";
import { Md } from "./Md";

const ET_TONE = { misconception: "rose", slip: "amber", guess: "violet", correct: "emerald" } as const;

function GapCard({ gap, name, i }: { gap: NonNullable<ReturnType<typeof useSession.getState>["diagnosis"]>["root_gaps"][number]; name: string; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Card transition={{ delay: 0.2 + i * 0.15 }} className="border-amber-400/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone="amber">Root gap</Badge>
          <h3 className="mt-2 text-xl font-bold">{name}</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-300">{Math.round(gap.confidence * 100)}%</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">confidence</div>
        </div>
      </div>
      <p className="mt-3 leading-relaxed text-slate-200">{gap.student_facing_summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">explains</span>
        {gap.explains_qids.map((q) => <Badge key={q} tone="rose">{q.replace(/^q/i, "Q")}</Badge>)}
      </div>
      <button onClick={() => setOpen((v) => !v)} className="mt-3 text-sm text-indigo-300 hover:text-indigo-200">
        {open ? "▾" : "▸"} AI reasoning
      </button>
      {open && <div className="mt-2 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-300"><Md>{gap.reasoning}</Md></div>}
    </Card>
  );
}

export function DiagnosisView() {
  const diagnosis = useSession((s) => s.diagnosis);
  const graded = useSession((s) => s.graded);
  const subject = useSession((s) => s.subject);
  const gapQueue = useSession((s) => s.gapQueue);
  const progress = useSession((s) => s.progress);
  const beginGap = useSession((s) => s.beginGap);
  const setPhase = useSession((s) => s.setPhase);
  const { concepts } = useGraph(subject);
  if (!diagnosis) return null;

  const next = gapQueue[0];
  const remainingGaps = diagnosis.root_gaps.filter((g) => gapQueue.includes(g.concept_id));
  const doneGaps = diagnosis.root_gaps.filter((g) => !gapQueue.includes(g.concept_id));
  const noGaps = diagnosis.root_gaps.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-bold">{noGaps ? "No gaps found 🎉" : `We found ${diagnosis.root_gaps.length} root ${diagnosis.root_gaps.length === 1 ? "gap" : "gaps"}`}</h2>
        {diagnosis.fallback && <Badge tone="slate">heuristic fallback</Badge>}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ConceptGraph mode="diagnosis" className="h-[380px] lg:h-[520px]" />
        </div>
        <div className="space-y-4">
          {noGaps && (
            <Card className="border-emerald-400/30 text-center">
              <div className="text-5xl">🌟</div>
              <p className="mt-3 text-lg text-slate-200">Every answer points to solid understanding. Nice work!</p>
              <Button variant="success" className="mt-4" onClick={() => setPhase("report")}>See my report →</Button>
            </Card>
          )}
          {remainingGaps.map((g, i) => <GapCard key={g.concept_id} gap={g} i={i} name={conceptName(concepts, g.concept_id)} />)}
          {doneGaps.map((g) => (
            <Card key={g.concept_id} className="flex items-center justify-between !py-3">
              <span className="font-medium">{conceptName(concepts, g.concept_id)}</span>
              <Badge tone={progress[g.concept_id]?.status === "mastered" ? "emerald" : "amber"}>{progress[g.concept_id]?.status ?? "done"}</Badge>
            </Card>
          ))}
          {next && (
            <Button className="w-full py-4 text-lg" onClick={() => beginGap(next)}>
              Fix this gap: {conceptName(concepts, next)} →
            </Button>
          )}
          {!next && !noGaps && <Button variant="success" className="w-full py-4 text-lg" onClick={() => setPhase("report")}>See my report →</Button>}

          <Card>
            <h3 className="font-semibold">Question breakdown</h3>
            <ul className="mt-3 space-y-3">
              {diagnosis.per_question.map((p) => {
                const g = graded.find((x) => x.qid === p.qid);
                return (
                  <li key={p.qid} className="rounded-xl bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-300">{p.qid.replace(/^q/i, "Q")}</span>
                      <Badge tone={ET_TONE[p.error_type]}>{p.error_type}</Badge>
                      {g && <span className="ml-auto text-xs text-slate-500">{Math.round(g.confidence * 100)}% sure</span>}
                    </div>
                    {p.error_type !== "correct" && p.misconception && <p className="mt-2 text-sm text-slate-300">{p.misconception}</p>}
                    {p.evidence && <p className="mt-1 text-xs text-slate-500">{p.evidence}</p>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold">Confidence vs. correctness</h3>
            <p className="mb-2 text-xs text-slate-400">Confident-but-wrong answers are the most valuable signal.</p>
            <ConfidenceQuadrant graded={graded} perQuestion={diagnosis.per_question} />
          </Card>
        </div>
      </div>
    </div>
  );
}
