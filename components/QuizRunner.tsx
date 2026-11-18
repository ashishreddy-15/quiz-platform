"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { grade } from "@/lib/client-api";
import type { StudentResponse } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { IconArrowLeft, IconArrowRight, IconChevronDown, IconChevronRight, Spinner } from "./icons";
import { Md } from "./Md";
import { Button, ErrorBox, Label, OptionRow, Page, ProgressBar, Segmented } from "./ui";

const CONFIDENCE = [
  { value: 0.15, label: "Guessing" },
  { value: 0.4, label: "Unsure" },
  { value: 0.7, label: "Fairly sure" },
  { value: 0.95, label: "Certain" },
];
const nearestConfidence = (c: number) => CONFIDENCE.reduce((a, b) => (Math.abs(b.value - c) < Math.abs(a.value - c) ? b : a)).value;

type Draft = { answer: string; confidence: number | null; why: string; ms: number };

export function QuizRunner() {
  const questions = useSession((s) => s.questions);
  const pack = useSession((s) => s.pack);
  const stored = useSession((s) => s.responses);
  const saveAnswer = useSession((s) => s.answer);
  const setGraded = useSession((s) => s.setGraded);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(stored.map((r) => [r.qid, { answer: r.answer, confidence: nearestConfidence(r.confidence), why: r.rationale ?? "", ms: r.timeMs }])),
  );
  const [idx, setIdx] = useState(() => Math.min(stored.length, Math.max(0, questions.length - 1)));
  const [showWhy, setShowWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());

  const q = questions[idx];
  const d: Draft = useMemo(() => drafts[q?.id] ?? { answer: "", confidence: null, why: "", ms: 0 }, [drafts, q?.id]);
  const last = idx === questions.length - 1;
  const ready = d.answer.trim().length > 0 && d.confidence !== null && !busy;

  useEffect(() => {
    shownAt.current = Date.now();
    setShowWhy(!!drafts[questions[idx]?.id]?.why);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const patch = useCallback((p: Partial<Draft>) => {
    if (!q) return;
    setDrafts((all) => ({ ...all, [q.id]: { ...(all[q.id] ?? { answer: "", confidence: null, why: "", ms: 0 }), ...p } }));
  }, [q]);

  const commit = useCallback((): Record<string, Draft> => {
    const elapsed = Date.now() - shownAt.current;
    shownAt.current = Date.now();
    const next = { ...drafts, [q.id]: { ...d, ms: d.ms + elapsed } };
    setDrafts(next);
    if (next[q.id].answer && next[q.id].confidence !== null) {
      saveAnswer({ qid: q.id, answer: d.answer.trim(), confidence: d.confidence!, timeMs: next[q.id].ms, ...(d.why.trim() ? { rationale: d.why.trim() } : {}) });
    }
    return next;
  }, [drafts, q, d, saveAnswer]);

  const finish = useCallback(async (all: Record<string, Draft>) => {
    setBusy(true); setError(null);
    const responses: StudentResponse[] = questions.map((x) => {
      const r = all[x.id];
      return { qid: x.id, answer: r.answer.trim(), confidence: r.confidence ?? 0.4, timeMs: r.ms, ...(r.why.trim() ? { rationale: r.why.trim() } : {}) };
    });
    try {
      const { graded } = await grade(responses, pack);
      setGraded(graded);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }, [questions, pack, setGraded]);

  const next = useCallback(() => {
    if (!ready) return;
    const all = commit();
    if (last) void finish(all);
    else setIdx((i) => i + 1);
  }, [ready, commit, last, finish]);

  const back = useCallback(() => {
    if (idx === 0 || busy) return;
    commit();
    setIdx((i) => i - 1);
  }, [idx, busy, commit]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") { e.preventDefault(); next(); return; }
      if (tag === "INPUT" || tag === "TEXTAREA" || !q?.options) return;
      const k = e.key.toLowerCase();
      const n = /^[1-9]$/.test(k) ? Number(k) - 1 : /^[a-h]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
      if (n >= 0 && n < q.options.length) patch({ answer: q.options[n].id });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [q, next, patch]);

  if (!q) return null;
  const helper = !d.answer ? "Choose an answer" : d.confidence === null ? "Pick how sure you are to continue" : null;

  return (
    <Page>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-text-2">Question <span className="text-text">{idx + 1}</span> of {questions.length}</span>
        <span className="hidden text-text-3 sm:inline">No right or wrong shown until the end</span>
      </div>
      <ProgressBar className="mt-2.5" value={(idx + (ready ? 1 : 0)) / questions.length} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
          <div className="mt-8 text-[20px] font-semibold leading-snug tracking-[-0.015em]"><Md>{q.stem}</Md></div>

          <div className="mt-6 space-y-2">
            {q.type === "mcq" && q.options ? (
              q.options.map((o, i) => (
                <OptionRow key={o.id} letter={String.fromCharCode(65 + i)} text={o.text} state={d.answer === o.id ? "selected" : "idle"} onClick={() => patch({ answer: o.id })} />
              ))
            ) : (
              <input autoFocus value={d.answer} onChange={(e) => patch({ answer: e.target.value })} placeholder="Type your answer"
                className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3.5 text-[15px] outline-none placeholder:text-text-3 focus:border-accent" />
            )}
          </div>

          <div className="mt-8">
            <Label className="mb-2">How sure are you?</Label>
            <Segmented label="How sure are you?" value={d.confidence} onChange={(v) => patch({ confidence: v })} options={CONFIDENCE} />
          </div>

          <div className="mt-5">
            <button onClick={() => setShowWhy((v) => !v)} className="flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text" aria-expanded={showWhy}>
              {showWhy ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              Explain your thinking <span className="text-text-3">· optional</span>
            </button>
            {showWhy && (
              <textarea value={d.why} onChange={(e) => patch({ why: e.target.value })} rows={3} placeholder="How did you get your answer?"
                className="mt-2 w-full resize-y rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-[14px] outline-none placeholder:text-text-3 focus:border-accent" />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {error && <div className="mt-6"><ErrorBox message={error} onRetry={() => void finish(drafts)} /></div>}

      <div className="mt-8 flex items-center gap-3 border-t border-border pt-5">
        <Button variant="secondary" onClick={back} disabled={idx === 0 || busy}><IconArrowLeft /> Back</Button>
        <span className="hidden flex-1 items-center gap-1.5 text-[12px] text-text-3 md:flex">
          <kbd>A</kbd>–<kbd>D</kbd> choose <span className="mx-1">·</span> <kbd>Enter</kbd> next
        </span>
        <div className="ml-auto flex items-center gap-3">
          {helper && <span className="hidden text-[13px] text-text-3 sm:inline">{helper}</span>}
          <Button onClick={next} disabled={!ready}>
            {busy ? <><Spinner /> Checking</> : last ? <>Finish quiz <IconArrowRight /></> : <>Next <IconArrowRight /></>}
          </Button>
        </div>
      </div>
      {helper && <p className="mt-2 text-right text-[13px] text-text-3 sm:hidden">{helper}</p>}
    </Page>
  );
}
