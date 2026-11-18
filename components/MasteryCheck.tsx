"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import clsx from "clsx";
import { motion } from "framer-motion";
import { MAX_RETEACH, isMastered } from "@/lib/api-contract";
import { getMastery } from "@/lib/client-api";
import { useSession } from "@/lib/store";
import { conceptName, useGraph } from "./hooks";
import { analogySummary } from "./lesson-utils";
import { Md } from "./Md";
import { Badge, Button, Card, ErrorBox, Skeleton } from "./ui";

type Result = { kind: "recall" | "application" | "transfer"; correct: boolean };
const KIND_TONE = { recall: "indigo", application: "violet", transfer: "amber" } as const;

export function MasteryCheck() {
  const conceptId = useSession((s) => s.currentGap)!;
  const subject = useSession((s) => s.subject);
  const items = useSession((s) => s.masteryItems);
  const lesson = useSession((s) => s.currentLesson);
  const progress = useSession((s) => s.progress[conceptId]);
  const diagnosis = useSession((s) => s.diagnosis);
  const setMasteryItems = useSession((s) => s.setMasteryItems);
  const recordMastery = useSession((s) => s.recordMastery);
  const beginGap = useSession((s) => s.beginGap);
  const nextGap = useSession((s) => s.nextGap);
  const setPhase = useSession((s) => s.setPhase);
  const { concepts } = useGraph(subject);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const recorded = useRef(false);
  const finished = results.length >= 3 && items.length === 3;
  const passed = finished && isMastered(results);
  const score = results.filter((r) => r.correct).length;

  useEffect(() => {
    if (items.length === 3) return;
    let live = true;
    setError(null);
    const gap = diagnosis?.root_gaps.find((g) => g.concept_id === conceptId);
    getMastery({ conceptId, misconception: gap?.student_facing_summary ?? "", attempt: progress?.attempts ?? 1 })
      .then((r) => live && setMasteryItems(r.items)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, tick]);

  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    recordMastery(conceptId, score, passed, analogySummary(lesson));
    if (passed) confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#34d399", "#818cf8", "#fbbf24"] });
  }, [finished, passed, score, conceptId, lesson, recordMastery]);

  const item = items[idx];
  const check = useCallback((id: string) => {
    if (picked || !item) return;
    setPicked(id);
  }, [picked, item]);
  const advance = useCallback(() => {
    if (!picked || !item) return;
    setResults((r) => [...r, { kind: item.kind, correct: picked === item.answer }]);
    setPicked(null);
    setIdx((i) => i + 1);
  }, [picked, item]);

  useEffect(() => {
    if (finished || !item) return;
    const h = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) check(item.options[n - 1].id);
      else if (e.key === "Enter") advance();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [item, finished, check, advance]);

  if (error) return <div className="mx-auto max-w-xl p-6"><ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} /></div>;
  if (items.length < 3)
    return <div className="mx-auto max-w-2xl space-y-3 px-4 py-8"><p className="text-center text-slate-400">Preparing your mastery check…</p><Skeleton className="h-56" /></div>;

  const name = conceptName(concepts, conceptId);

  if (finished) {
    const attempts = progress?.attempts ?? 1;
    const canRetry = attempts <= MAX_RETEACH;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className={clsx("text-center", passed ? "border-emerald-400/40" : "border-amber-400/40")}>
          <div className="text-6xl">{passed ? "🎉" : "🤔"}</div>
          <h2 className="mt-3 text-3xl font-bold">{passed ? `${name} mastered!` : "Not quite there yet"}</h2>
          <p className="mt-2 text-slate-300">You got {score} of 3 right.</p>
          <div className="mt-4 flex justify-center gap-2">
            {results.map((r, i) => <Badge key={i} tone={r.correct ? "emerald" : "rose"}>{r.kind} {r.correct ? "✓" : "✕"}</Badge>)}
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {passed ? (
              <>
                <Button variant="success" onClick={() => setPhase("teachback")}>Teach it back 🧑‍🏫</Button>
                <Button variant="ghost" onClick={nextGap}>Next gap →</Button>
              </>
            ) : canRetry ? (
              <Button onClick={() => beginGap(conceptId)}>Let&apos;s try a different explanation →</Button>
            ) : (
              <>
                <p className="w-full text-sm text-amber-200">This one is tough. We&apos;ll flag it so a teacher can help.</p>
                <Button variant="ghost" onClick={nextGap}>Flag for teacher &amp; move on →</Button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Mastery check: {name}</h2>
        <span className="text-sm text-slate-400">{idx + 1} / 3</span>
      </div>
      <motion.div key={idx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
        <Card>
          <Badge tone={KIND_TONE[item.kind]} className="capitalize">{item.kind}</Badge>
          <div className="mt-3 text-xl font-semibold"><Md>{item.stem}</Md></div>
          <div className="mt-5 grid gap-3">
            {item.options.map((o, i) => {
              const isAns = o.id === item.answer;
              const show = picked !== null;
              return (
                <button key={o.id} disabled={show} onClick={() => check(o.id)}
                  className={clsx("flex items-center gap-3 rounded-xl border-2 p-4 text-left text-lg transition",
                    !show && "border-slate-700 bg-slate-900/50 hover:border-slate-500",
                    show && isAns && "border-emerald-400 bg-emerald-500/15",
                    show && !isAns && picked === o.id && "border-rose-400 bg-rose-500/15",
                    show && !isAns && picked !== o.id && "border-slate-800 opacity-50")}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-700 text-sm font-bold">{String.fromCharCode(65 + i)}</span>
                  <Md>{o.text}</Md>
                  {show && isAns && <span className="ml-auto text-emerald-300">✓</span>}
                  {show && !isAns && picked === o.id && <span className="ml-auto text-rose-300">✕</span>}
                </button>
              );
            })}
          </div>
          {picked && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={clsx("mt-5 rounded-xl p-4", picked === item.answer ? "bg-emerald-500/10 text-emerald-100" : "bg-rose-500/10 text-rose-100")}>
              <p className="font-semibold">{picked === item.answer ? "Correct ✓" : "Not quite"}</p>
              <div className="mt-1 text-sm opacity-90"><Md>{item.explanation}</Md></div>
              <Button className="mt-4" onClick={advance}>{idx === 2 ? "See result →" : "Next →"}</Button>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
