"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { getQuiz, grade } from "@/lib/client-api";
import type { PublicQuestion, StudentResponse } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { Md } from "./Md";
import { Button, Card, ErrorBox, Skeleton, Spinner } from "./ui";

const LABELS = ["Guessing", "Unsure", "Pretty sure", "Certain"];

function ConfidenceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const idx = value < 25 ? 0 : value < 50 ? 1 : value < 80 ? 2 : 3;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-200">How sure are you?</span>
        <span className="text-sm font-bold text-indigo-300">{value}% · {LABELS[idx]}</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(+e.target.value)}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-indigo-400"
        style={{ background: `linear-gradient(90deg,#6366f1 ${value}%,#1e293b ${value}%)` }} aria-label="Confidence" />
      <div className="mt-2 flex justify-between text-[11px] text-slate-500 sm:text-xs">
        {LABELS.map((l, i) => <span key={l} className={clsx(i === idx && "font-semibold text-indigo-300")}>{l}</span>)}
      </div>
    </div>
  );
}

function QuestionCard({ q, index, total, last, onSubmit, busy }: {
  q: PublicQuestion; index: number; total: number; last: boolean; busy: boolean; onSubmit: (r: StudentResponse) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [why, setWhy] = useState("");
  const [showWhy, setShowWhy] = useState(false);
  const t0 = useRef(0);
  useEffect(() => { t0.current = Date.now(); }, []);

  const ready = answer.trim().length > 0 && !busy;
  const submit = useCallback(() => {
    if (!ready) return;
    onSubmit({ qid: q.id, answer: answer.trim(), confidence: confidence / 100, timeMs: Date.now() - t0.current, rationale: why.trim() || undefined });
  }, [ready, onSubmit, q.id, answer, confidence, why]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "Enter" && tag !== "TEXTAREA") { e.preventDefault(); submit(); return; }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const n = Number(e.key);
      if (q.type === "mcq" && q.options && n >= 1 && n <= q.options.length) setAnswer(q.options[n - 1].id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [q, submit]);

  return (
    <Card>
      <div className="text-sm font-medium text-indigo-300">Question {index + 1} of {total}</div>
      <div className="mt-2 text-xl font-semibold leading-snug sm:text-2xl"><Md>{q.stem}</Md></div>

      <div className="mt-6">
        {q.type === "mcq" && q.options ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <button key={o.id} onClick={() => setAnswer(o.id)}
                className={clsx("flex items-center gap-3 rounded-xl border-2 p-4 text-left text-lg transition",
                  answer === o.id ? "border-indigo-400 bg-indigo-500/20" : "border-slate-700 bg-slate-900/50 hover:border-slate-500")}>
                <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
                  answer === o.id ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300")}>{String.fromCharCode(65 + i)}</span>
                <Md>{o.text}</Md>
              </button>
            ))}
          </div>
        ) : (
          <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer…"
            className="w-full rounded-xl border-2 border-slate-700 bg-slate-900/60 px-4 py-3 text-lg outline-none focus:border-indigo-400" />
        )}
      </div>

      <div className="mt-8"><ConfidenceSlider value={confidence} onChange={setConfidence} /></div>

      <div className="mt-5">
        <button onClick={() => setShowWhy((v) => !v)} className="text-sm text-slate-400 hover:text-slate-200">
          {showWhy ? "▾" : "▸"} Why did you pick this? <span className="text-slate-600">(optional)</span>
        </button>
        {showWhy && (
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Tell us how you were thinking…"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 outline-none focus:border-indigo-400" />
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="hidden text-xs text-slate-500 sm:inline">Press 1–4 to choose · Enter to continue</span>
        <Button className="ml-auto" disabled={!ready} onClick={submit}>
          {busy ? <><Spinner /> Grading…</> : last ? "Finish & find my gaps →" : "Next →"}
        </Button>
      </div>
    </Card>
  );
}

function Quiz({ questions }: { questions: PublicQuestion[] }) {
  const stored = useSession((s) => s.responses);
  const answer = useSession((s) => s.answer);
  const setGraded = useSession((s) => s.setGraded);
  const collected = useRef<StudentResponse[]>(stored);
  const [idx, setIdx] = useState(stored.length < questions.length ? stored.length : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const { graded } = await grade(collected.current);
      setGraded(graded);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }, [setGraded]);

  const onSubmit = (r: StudentResponse) => {
    answer(r);
    collected.current = [...collected.current.filter((x) => x.qid !== r.qid), r];
    if (idx + 1 >= questions.length) void finish();
    else setIdx(idx + 1);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 flex items-center justify-center gap-2">
        {questions.map((q, i) => (
          <span key={q.id} className={clsx("h-2.5 rounded-full transition-all", i === idx ? "w-8 bg-indigo-400" : i < idx ? "w-2.5 bg-emerald-400" : "w-2.5 bg-slate-700")} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={questions[idx].id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          <QuestionCard q={questions[idx]} index={idx} total={questions.length} last={idx + 1 >= questions.length} busy={busy} onSubmit={onSubmit} />
        </motion.div>
      </AnimatePresence>
      {error && <div className="mt-4"><ErrorBox message={error} onRetry={finish} /></div>}
    </div>
  );
}

export function QuizRunner() {
  const subject = useSession((s) => s.subject);
  const questions = useSession((s) => s.questions);
  const setQuestions = useSession((s) => s.setQuestions);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!subject || questions.length > 0) return;
    let live = true;
    setError(null);
    getQuiz(subject).then((r) => live && setQuestions(r.questions)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [subject, questions.length, setQuestions, tick]);

  if (error) return <div className="mx-auto max-w-xl p-6"><ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} /></div>;
  if (questions.length === 0)
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p className="text-center text-slate-400">Preparing your questions…</p>
        <Skeleton className="h-64 w-full" /><Skeleton className="h-24 w-full" />
      </div>
    );
  return <Quiz questions={questions} />;
}
