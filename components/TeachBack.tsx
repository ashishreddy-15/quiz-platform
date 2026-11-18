"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { teachback } from "@/lib/client-api";
import type { TeachbackResult } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { conceptName, useGraph } from "./hooks";
import { Badge, Button, Card, ErrorBox, Spinner } from "./ui";

function Ring({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
      <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" transform="rotate(-90 60 60)"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.1, ease: "easeOut" }} />
      <text x="60" y="68" textAnchor="middle" fontSize="28" fontWeight="800" fill="#fff">{Math.round(score)}</text>
    </svg>
  );
}
function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-semibold">{v.toFixed(1)}/10</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" initial={{ width: 0 }} animate={{ width: `${v * 10}%` }} transition={{ duration: 0.9 }} />
      </div>
    </div>
  );
}

export function TeachBack() {
  const conceptId = useSession((s) => s.currentGap)!;
  const subject = useSession((s) => s.subject);
  const diagnosis = useSession((s) => s.diagnosis);
  const recordTeachback = useSession((s) => s.recordTeachback);
  const nextGap = useSession((s) => s.nextGap);
  const { concepts } = useGraph(subject);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TeachbackResult | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const gap = diagnosis?.root_gaps.find((g) => g.concept_id === conceptId);
      const r = await teachback({ conceptId, explanation: text.trim(), misconception: gap?.student_facing_summary ?? "" });
      recordTeachback(conceptId, r);
      setResult(r);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <Badge tone="violet">Teach it back</Badge>
        <h2 className="mt-3 text-2xl font-bold">Explain {conceptName(concepts, conceptId)} to a 10-year-old</h2>
        <p className="mt-1 text-slate-400">If you can teach it simply, you really understand it.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} disabled={!!result || busy}
          placeholder="Imagine your little cousin asks you about this…" className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-lg outline-none focus:border-indigo-400" />
        {!result && (
          <div className="mt-4 flex gap-3">
            <Button disabled={text.trim().length < 10 || busy} onClick={submit}>{busy ? <><Spinner /> Evaluating…</> : "Check my explanation"}</Button>
            <Button variant="ghost" onClick={nextGap}>Skip</Button>
          </div>
        )}
        {error && <div className="mt-4"><ErrorBox message={error} onRetry={submit} /></div>}
      </Card>

      {result && (
        <Card className="mt-5">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Ring score={result.score} />
            <div className="w-full space-y-4"><Bar label="Accuracy" v={result.accuracy} /><Bar label="Completeness" v={result.completeness} /></div>
          </div>
          {result.misconception_present && (
            <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-amber-100">⚠️ Part of the original misconception still shows up in your explanation.</div>
          )}
          <div className="mt-4 rounded-xl bg-indigo-500/10 p-4 text-indigo-100"><span className="font-semibold">Coach tip:</span> {result.tip}</div>
          <Button className="mt-5 w-full" onClick={nextGap}>Continue →</Button>
        </Card>
      )}
    </div>
  );
}
