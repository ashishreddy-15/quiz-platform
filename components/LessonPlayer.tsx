"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { getMastery, streamLesson } from "@/lib/client-api";
import { useSession } from "@/lib/store";
import { conceptName, useConcepts } from "./hooks";
import { IconArrowRight, IconChevronDown, IconChevronRight } from "./icons";
import { LearningPath } from "./LearningPath";
import { splitReveals, splitSections, type Section } from "./lesson-utils";
import { Md } from "./Md";
import { Badge, Button, ErrorBox, Label, Page, Skeleton } from "./ui";

function Reveal({ summary, text }: { summary: string; text: string }) {
  const [open, setOpen] = useState(false);
  const label = summary && !/answer/i.test(summary) ? summary : "Show answer";
  return (
    <div className="my-3 rounded-lg border border-border">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] font-medium text-text-2 hover:text-text">
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        {open ? "Hide answer" : label}
      </button>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="border-t border-border px-3.5 py-3 text-[15px]">
          <Md>{text}</Md>
        </motion.div>
      )}
    </div>
  );
}

function SectionBody({ body, cursor }: { body: string; cursor: boolean }) {
  const segs = splitReveals(body);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "md" ? (
          <div key={i} className={clsx(cursor && i === segs.length - 1 && "streaming")}><Md>{s.text}</Md></div>
        ) : <Reveal key={i} summary={s.summary} text={s.text} />,
      )}
      {segs.length === 0 && cursor && <span className="caret" />}
    </>
  );
}

function LessonSection({ s, streaming, interest }: { s: Section; streaming: boolean; interest: string }) {
  const analogy = s.heading.toLowerCase().startsWith("analogy");
  if (analogy)
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="rounded-md border-l-2 border-accent bg-surface-2 px-5 py-4">
        <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.06em] text-accent-text">Analogy · {interest}</div>
        <div className="text-[15px] leading-relaxed text-text"><SectionBody body={s.body} cursor={streaming} /></div>
      </motion.section>
    );
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>
      <h2 className="mb-2 text-[16px] font-semibold tracking-[-0.01em]">{s.heading}</h2>
      <div className="text-[15px] leading-relaxed text-text/90"><SectionBody body={s.body} cursor={streaming} /></div>
    </motion.section>
  );
}

export function LessonPlayer() {
  const conceptId = useSession((s) => s.currentGap)!;
  const pack = useSession((s) => s.pack);
  const interest = useSession((s) => s.interest);
  const diagnosis = useSession((s) => s.diagnosis);
  const graded = useSession((s) => s.graded);
  const progress = useSession((s) => s.progress[conceptId]);
  const stored = useSession((s) => s.currentLesson);
  const hasItems = useSession((s) => s.masteryItems.length > 0);
  const setLesson = useSession((s) => s.setLesson);
  const setMasteryItems = useSession((s) => s.setMasteryItems);
  const setPhase = useSession((s) => s.setPhase);
  const concepts = useConcepts();

  const [text, setText] = useState(stored);
  const [done, setDone] = useState(stored.length > 0);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const attempts = progress?.attempts ?? 1;
  const ran = useRef(false);

  const gaps = diagnosis?.root_gaps ?? [];
  const gapNo = Math.max(1, gaps.findIndex((g) => g.concept_id === conceptId) + 1);
  const concept = concepts.find((c) => c.id === conceptId);

  const req = useMemo(() => {
    const gap = gaps.find((g) => g.concept_id === conceptId);
    const qid = gap?.explains_qids.find((q) => graded.some((g) => g.qid === q && !g.correct)) ?? gap?.explains_qids[0];
    const g = graded.find((x) => x.qid === qid) ?? graded.find((x) => !x.correct);
    const misconception = diagnosis?.per_question.find((p) => p.qid === g?.qid)?.misconception || gap?.student_facing_summary || "";
    const prev = progress?.analogies.at(-1);
    return {
      conceptId, misconception, wrongAnswer: g?.chosenText ?? "", stem: g?.stem ?? "", interest, attempt: attempts,
      ...(prev ? { previousAnalogy: prev } : {}),
      ...(pack ? { pack } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, attempts, interest, diagnosis, graded, pack]);

  useEffect(() => {
    if (stored.length > 0 && tick === 0) return; // resumed from persisted state
    if (ran.current && tick === 0) return;
    ran.current = true;
    const ac = new AbortController();
    setText(""); setDone(false); setError(null);
    streamLesson(req, setText, ac.signal)
      .then(({ text: t, fallback: f }) => { setText(t); setLesson(t); setFallback(f); setDone(true); })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    // Prefetch the mastery check while the lesson streams.
    if (!hasItems || tick > 0) {
      getMastery({ conceptId, misconception: req.misconception, attempt: attempts, ...(pack ? { pack } : {}) })
        .then((r) => setMasteryItems(r.items)).catch(() => {});
    }
    return () => { ac.abort(); ran.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const sections = splitSections(text);
  const retry = () => setTick((t) => t + 1);

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-3">
        <Label>Lesson</Label>
        <span>· {gapNo} of {Math.max(1, gaps.length)} {gaps.length === 1 ? "gap" : "gaps"}</span>
        <span>· attempt {attempts}</span>
        {fallback && <Badge className="ml-auto">Offline lesson</Badge>}
      </div>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{conceptName(concepts, conceptId)}</h1>
      {concept?.description && <p className="mt-1.5 text-[15px] text-text-2">{concept.description}</p>}
      {attempts > 1 && <p className="mt-3 text-[13px] text-text-2">Trying a different explanation this time.</p>}

      <div className="mt-6"><LearningPath compact /></div>

      <article className="mt-10 space-y-9">
        {sections.length === 0 && !error && (
          <div className="space-y-3" aria-busy>
            <p className="text-[13px] text-text-3">Writing a lesson for you…</p>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        )}
        {sections.map((s, i) => <LessonSection key={s.heading + i} s={s} interest={interest} streaming={!done && i === sections.length - 1} />)}
      </article>

      {error && <div className="mt-6"><ErrorBox message={error} onRetry={retry} /></div>}

      <div className={clsx("mt-12 flex flex-wrap items-center gap-3 border-t border-border pt-6 transition-opacity duration-150", !done && "pointer-events-none opacity-40")}>
        <Button size="lg" disabled={!done} onClick={() => setPhase("mastery")}>I&apos;m ready — check my understanding <IconArrowRight /></Button>
        <span className="text-[13px] text-text-3">{done ? "3 questions · instant feedback" : "Finishing the lesson…"}</span>
      </div>
    </Page>
  );
}
