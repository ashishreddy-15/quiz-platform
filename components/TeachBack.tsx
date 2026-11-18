"use client";
import { useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { teachback } from "@/lib/client-api";
import type { TeachbackResult } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { conceptName, useConcepts } from "./hooks";
import { IconAlert, IconArrowRight, IconSpark, Spinner } from "./icons";
import { Button, ErrorBox, Label, Page, ProgressBar } from "./ui";

function Meter({ label, v }: { label: string; v: number }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3 px-4 py-3">
      <span className="text-text-2">{label}</span>
      <ProgressBar value={v / 10} tone={v >= 7 ? "success" : "accent"} />
      <span className="text-right tabular-nums text-text">{v.toFixed(1)}<span className="text-text-3">/10</span></span>
    </div>
  );
}

export function TeachBack() {
  const conceptId = useSession((s) => s.currentGap)!;
  const pack = useSession((s) => s.pack);
  const diagnosis = useSession((s) => s.diagnosis);
  const gapQueue = useSession((s) => s.gapQueue);
  const recordTeachback = useSession((s) => s.recordTeachback);
  const nextGap = useSession((s) => s.nextGap);
  const concepts = useConcepts();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TeachbackResult | null>(null);
  const name = conceptName(concepts, conceptId);
  const isLast = gapQueue.length <= 1;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const gap = diagnosis?.root_gaps.find((g) => g.concept_id === conceptId);
      const r = await teachback({ conceptId, explanation: text.trim(), misconception: gap?.student_facing_summary ?? "", ...(pack ? { pack } : {}) });
      recordTeachback(conceptId, r);
      setResult(r);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <Page>
      <Label>Explain it back · {name}</Label>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Explain it as if to a friend</h1>
      <p className="mt-2 text-[15px] text-text-2">In two or three sentences, say what {name.toLowerCase()} means and why it matters. If you can teach it, you know it.</p>

      <div className="mt-6">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} disabled={!!result || busy} autoFocus
          placeholder="So basically…" aria-label="Your explanation"
          className="w-full resize-y rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[15px] leading-relaxed outline-none placeholder:text-text-3 focus:border-accent disabled:opacity-70" />
        <div className="mt-1 text-right text-[12px] tabular-nums text-text-3">{words} words</div>
      </div>

      {!result && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={words < 3 || busy} onClick={submit}>{busy ? <><Spinner /> Reading your explanation</> : "Check my explanation"}</Button>
          <Button size="lg" variant="ghost" onClick={nextGap} disabled={busy}>Skip</Button>
        </div>
      )}
      {error && <div className="mt-4"><ErrorBox message={error} onRetry={submit} /></div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="mt-8">
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-baseline gap-3 border-b border-border px-4 py-3">
              <span className="text-text-2">Score</span>
              <span className="ml-auto text-[20px] font-semibold tabular-nums">{Math.round(result.score)}<span className="text-[14px] font-normal text-text-3">/100</span></span>
            </div>
            <Meter label="Accuracy" v={result.accuracy} />
            <div className="border-t border-border"><Meter label="Completeness" v={result.completeness} /></div>
            {result.misconception_present && (
              <div className="flex items-start gap-3 border-t border-border px-4 py-3">
                <IconAlert className="mt-0.5 shrink-0 text-warning" />
                <span>Part of the original misconception still shows up in your explanation.</span>
              </div>
            )}
            <div className={clsx("flex items-start gap-3 border-t border-border bg-surface px-4 py-3")}>
              <IconSpark className="mt-0.5 shrink-0 text-accent-text" />
              <div><div className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-3">Coaching tip</div><p className="mt-0.5">{result.tip}</p></div>
            </div>
          </div>
          <Button size="lg" className="mt-6" onClick={nextGap}>{isLast ? "See my report" : "Continue to next gap"} <IconArrowRight /></Button>
        </motion.div>
      )}
    </Page>
  );
}
