"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { diagnose } from "@/lib/client-api";
import { useSession } from "@/lib/store";
import { ConceptGraph } from "./ConceptGraph";
import { ErrorBox, Spinner } from "./ui";

const MIN_MS = 3000; // let the graph animation play even if the LLM is fast

export function DiagnosingView() {
  const subject = useSession((s) => s.subject);
  const graded = useSession((s) => s.graded);
  const setDiagnosis = useSession((s) => s.setDiagnosis);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    if (!subject) return;
    setError(null);
    const t0 = Date.now();
    try {
      const d = await diagnose(subject, graded);
      const wait = Math.max(0, MIN_MS - (Date.now() - t0));
      setTimeout(() => setDiagnosis(d), wait);
    } catch (e) { setError((e as Error).message); }
  }, [subject, graded, setDiagnosis]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-center">
      <h2 className="text-3xl font-bold">Analyzing your thinking…</h2>
      <p className="mt-2 flex items-center justify-center gap-2 text-slate-400">
        {!error && <Spinner />} Tracing each wrong answer back through the concepts it depends on
      </p>
      <div className="mt-6 text-left"><ConceptGraph mode="diagnosing" className="h-[460px]" /></div>
      {error && <div className="mt-4 text-left"><ErrorBox message={error} onRetry={() => { started.current = true; void run(); }} /></div>}
    </div>
  );
}
