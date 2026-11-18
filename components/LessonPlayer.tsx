"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { getMastery, streamLesson } from "@/lib/client-api";
import { useSession } from "@/lib/store";
import { ConceptGraph } from "./ConceptGraph";
import { conceptName, useGraph } from "./hooks";
import { splitReveals, splitSections, type Section } from "./lesson-utils";
import { Md } from "./Md";
import { Badge, Button, ErrorBox, Skeleton } from "./ui";

function Reveal({ summary, text }: { summary: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-3">
      <Button variant="ghost" className="!py-2 text-sm" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Reveal"} answer{summary && !/answer/i.test(summary) ? ` · ${summary}` : ""}</Button>
      {open && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><Md>{text}</Md></motion.div>}
    </div>
  );
}

function SectionBody({ body, cursor }: { body: string; cursor: boolean }) {
  const segs = splitReveals(body);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "md" ? (
          <div key={i} className={clsx(cursor && i === segs.length - 1 && "cursor-blink")}><Md>{s.text}</Md></div>
        ) : <Reveal key={i} summary={s.summary} text={s.text} />,
      )}
      {segs.length === 0 && cursor && <span className="cursor-blink" />}
    </>
  );
}

function SectionCard({ s, streaming }: { s: Section; streaming: boolean }) {
  const analogy = s.heading.toLowerCase().startsWith("analogy");
  return (
    <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4 }}
      className={clsx("rounded-2xl p-5 sm:p-6", analogy
        ? "border border-fuchsia-400/40 bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-fuchsia-500/25 shadow-lg shadow-fuchsia-500/10"
        : "glass")}>
      <h3 className={clsx("mb-2 text-sm font-bold uppercase tracking-wider", analogy ? "text-fuchsia-200" : "text-indigo-300")}>
        {analogy ? "🔗 " : ""}{s.heading}
      </h3>
      <div className="text-lg"><SectionBody body={s.body} cursor={streaming} /></div>
    </motion.section>
  );
}

export function LessonPlayer() {
  const conceptId = useSession((s) => s.currentGap)!;
  const subject = useSession((s) => s.subject);
  const interest = useSession((s) => s.interest);
  const diagnosis = useSession((s) => s.diagnosis);
  const graded = useSession((s) => s.graded);
  const progress = useSession((s) => s.progress[conceptId]);
  const stored = useSession((s) => s.currentLesson);
  const hasItems = useSession((s) => s.masteryItems.length > 0);
  const setLesson = useSession((s) => s.setLesson);
  const setMasteryItems = useSession((s) => s.setMasteryItems);
  const setPhase = useSession((s) => s.setPhase);
  const { concepts } = useGraph(subject);

  const [text, setText] = useState(stored);
  const [done, setDone] = useState(stored.length > 0);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const attempts = progress?.attempts ?? 1;
  const ran = useRef(false);

  const req = useMemo(() => {
    const gap = diagnosis?.root_gaps.find((g) => g.concept_id === conceptId);
    const qid = gap?.explains_qids.find((q) => graded.some((g) => g.qid === q && !g.correct)) ?? gap?.explains_qids[0];
    const g = graded.find((x) => x.qid === qid) ?? graded.find((x) => !x.correct);
    const misconception = diagnosis?.per_question.find((p) => p.qid === g?.qid)?.misconception || gap?.student_facing_summary || "";
    const prev = progress?.analogies.at(-1);
    return {
      conceptId, misconception, wrongAnswer: g?.chosenText ?? "", stem: g?.stem ?? "", interest, attempt: attempts,
      ...(prev ? { previousAnalogy: prev } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, attempts, interest, diagnosis, graded]);

  useEffect(() => {
    if (stored.length > 0 && tick === 0) return; // resumed from persisted state
    if (ran.current && tick === 0) return;
    ran.current = true;
    const ac = new AbortController();
    setText(""); setDone(false); setError(null);
    streamLesson(req, setText, ac.signal)
      .then(({ text: t, fallback: f }) => { setText(t); setLesson(t); setFallback(f); setDone(true); })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    if (!hasItems || tick > 0) {
      getMastery({ conceptId, misconception: req.misconception, attempt: attempts })
        .then((r) => setMasteryItems(r.items)).catch(() => {});
    }
    return () => { ac.abort(); ran.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const sections = splitSections(text);
  const retry = () => setTick((t) => t + 1);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-3xl font-bold">{conceptName(concepts, conceptId)}</h2>
          <Badge tone="indigo">Attempt {attempts}</Badge>
          {fallback && <Badge tone="slate">offline lesson</Badge>}
        </div>
        {sections.length === 0 && !error && (
          <div className="space-y-3"><p className="text-slate-400">Writing a lesson just for you…</p><Skeleton className="h-28" /><Skeleton className="h-20" /></div>
        )}
        {sections.map((s, i) => <SectionCard key={s.heading} s={s} streaming={!done && i === sections.length - 1} />)}
        {error && <ErrorBox message={error} onRetry={retry} />}
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button variant="success" className="w-full py-4 text-lg" onClick={() => setPhase("mastery")}>I&apos;m ready, check my mastery →</Button>
          </motion.div>
        )}
      </div>
      <aside className="order-first lg:order-none lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Your concept map</p>
        <ConceptGraph mode="static" className="h-56 lg:h-80" />
      </aside>
    </div>
  );
}
