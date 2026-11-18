"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { MAX_RETEACH, isMastered } from "@/lib/api-contract";
import { getMastery } from "@/lib/client-api";
import type { MasteryItem } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { conceptName, useConcepts } from "./hooks";
import { IconArrowRight, IconCheck, IconCheckCircle, IconFlag, IconRefresh, IconX } from "./icons";
import { Md } from "./Md";
import { Button, ErrorBox, Label, OptionRow, Page, ProgressBar, Skeleton, type OptionState } from "./ui";
import { analogySummary } from "./lesson-utils";

type Result = { kind: MasteryItem["kind"]; correct: boolean };
const KIND: Record<MasteryItem["kind"], string> = { recall: "Recall", application: "Apply", transfer: "Transfer" };
const KIND_HINT: Record<MasteryItem["kind"], string> = {
  recall: "Do you remember the idea?",
  application: "Can you use it?",
  transfer: "Can you use it somewhere new?",
};

export function MasteryCheck() {
  const conceptId = useSession((s) => s.currentGap)!;
  const pack = useSession((s) => s.pack);
  const items = useSession((s) => s.masteryItems);
  const lesson = useSession((s) => s.currentLesson);
  const progress = useSession((s) => s.progress[conceptId]);
  const diagnosis = useSession((s) => s.diagnosis);
  const gapQueue = useSession((s) => s.gapQueue);
  const setMasteryItems = useSession((s) => s.setMasteryItems);
  const recordMastery = useSession((s) => s.recordMastery);
  const beginGap = useSession((s) => s.beginGap);
  const nextGap = useSession((s) => s.nextGap);
  const setPhase = useSession((s) => s.setPhase);
  const concepts = useConcepts();

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
    getMastery({ conceptId, misconception: gap?.student_facing_summary ?? "", attempt: progress?.attempts ?? 1, ...(pack ? { pack } : {}) })
      .then((r) => live && setMasteryItems(r.items)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, tick]);

  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    recordMastery(conceptId, score, passed, analogySummary(lesson));
  }, [finished, passed, score, conceptId, lesson, recordMastery]);

  const item = items[idx];
  const choose = useCallback((id: string) => { if (!picked && item) setPicked(id); }, [picked, item]);
  const advance = useCallback(() => {
    if (!picked || !item) return;
    setResults((r) => [...r, { kind: item.kind, correct: picked === item.answer }]);
    setPicked(null);
    setIdx((i) => i + 1);
  }, [picked, item]);

  useEffect(() => {
    if (finished || !item) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const n = /^[1-4]$/.test(k) ? Number(k) - 1 : /^[a-d]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
      if (n >= 0 && item.options[n]) choose(item.options[n].id);
      else if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") advance();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [item, finished, choose, advance]);

  const name = conceptName(concepts, conceptId);

  if (error)
    return <Page><ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} /></Page>;
  if (items.length < 3)
    return (
      <Page>
        <Label>Check · {name}</Label>
        <p className="mt-3 text-text-2">Preparing 3 questions…</p>
        <div className="mt-6 space-y-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
      </Page>
    );

  if (finished) {
    const attempts = progress?.attempts ?? 1;
    const canRetry = attempts <= MAX_RETEACH;
    const isLast = gapQueue.length <= 1;
    return (
      <Page>
        <Label>Check · {name}</Label>
        <div className="mt-5 flex items-start gap-3">
          {passed ? <IconCheckCircle size={24} className="mt-1 shrink-0 text-success" /> : <IconRefresh size={22} className="mt-1 shrink-0 text-text-2" />}
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
              {score} of 3 correct <span className="text-text-3">·</span>{" "}
              <span className={passed ? "text-success" : "text-text-2"}>{passed ? "Mastered" : "Not yet"}</span>
            </h1>
            <p className="mt-2 text-[15px] text-text-2">
              {passed ? `You've got ${name}. Explaining it in your own words locks it in.`
                : canRetry ? "That's normal. A second explanation from a different angle usually does it."
                : "This one is tough. We'll flag it so your teacher can help, and keep going."}
            </p>
          </div>
        </div>

        <ul className="mt-6 overflow-hidden rounded-lg border border-border">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
              {r.correct ? <IconCheck className="text-success" /> : <IconX className="text-danger" />}
              <span className="font-medium">{KIND[r.kind]}</span>
              <span className="truncate text-[13px] text-text-3">{KIND_HINT[r.kind]}</span>
              <span className={clsx("ml-auto text-[13px]", r.correct ? "text-text-2" : "text-danger")}>{r.correct ? "Correct" : "Missed"}</span>
            </li>
          ))}
        </ul>
        {!passed && score >= 2 && <p className="mt-2 text-[13px] text-text-3">Mastery needs the transfer question right too.</p>}

        <div className="mt-8 flex flex-wrap gap-3">
          {passed ? (
            <>
              <Button size="lg" onClick={() => setPhase("teachback")}>Explain it back <IconArrowRight /></Button>
              <Button size="lg" variant="secondary" onClick={nextGap}>{isLast ? "Skip to report" : "Skip to next gap"}</Button>
            </>
          ) : canRetry ? (
            <Button size="lg" onClick={() => beginGap(conceptId)}><IconRefresh /> Let&apos;s try a different explanation</Button>
          ) : (
            <Button size="lg" onClick={nextGap}><IconFlag /> Flag for teacher &amp; continue</Button>
          )}
        </div>
      </Page>
    );
  }

  const states = (id: string): OptionState => {
    if (!picked) return "idle";
    if (id === item.answer) return "correct";
    if (id === picked) return "wrong";
    return "dim";
  };
  const right = picked === item.answer;

  return (
    <Page>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-text-2">Check · <span className="text-text">{name}</span></span>
        <span className="tabular-nums text-text-3">{idx + 1} of 3</span>
      </div>
      <ProgressBar className="mt-2.5" value={(idx + (picked ? 1 : 0)) / 3} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
          <div className="mt-8 flex items-center gap-2">
            <span className="rounded border border-border px-1.5 text-[12px] font-medium leading-5 text-accent-text">{KIND[item.kind]}</span>
            <span className="text-[13px] text-text-3">{KIND_HINT[item.kind]}</span>
          </div>
          <div className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.015em]"><Md>{item.stem}</Md></div>
          <div className="mt-6 space-y-2">
            {item.options.map((o, i) => (
              <OptionRow key={o.id} letter={String.fromCharCode(65 + i)} text={o.text} state={states(o.id)} disabled={!!picked} onClick={() => choose(o.id)} />
            ))}
          </div>
          {picked && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
              className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
              <div className={clsx("flex items-center gap-2 font-medium", right ? "text-success" : "text-danger")}>
                {right ? <IconCheck /> : <IconX />} {right ? "Correct" : "Not quite"}
              </div>
              <div className="mt-1 text-[14px] text-text-2"><Md>{item.explanation}</Md></div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center gap-3 border-t border-border pt-5">
        <span className="hidden items-center gap-1.5 text-[12px] text-text-3 md:flex">
          <kbd>A</kbd>–<kbd>D</kbd> choose <span className="mx-1">·</span> <kbd>Enter</kbd> next
        </span>
        <Button className="ml-auto" disabled={!picked} onClick={advance}>
          {idx === 2 ? "See result" : "Next"} <IconArrowRight />
        </Button>
      </div>
    </Page>
  );
}
