"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { diagnose } from "@/lib/client-api";
import { useSession } from "@/lib/store";
import { Checklist, ErrorBox, Label, Page } from "./ui";

const MIN_MS = 1500;
const STEPS = ["Checking answers", "Tracing mistakes to prerequisites", "Picking where to start"];

export function DiagnosingView() {
  const subject = useSession((s) => s.subject);
  const pack = useSession((s) => s.pack);
  const graded = useSession((s) => s.graded);
  const setDiagnosis = useSession((s) => s.setDiagnosis);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null); setDone(false);
    const t0 = Date.now();
    try {
      const d = await diagnose(subject ?? pack?.subject ?? "topic", graded, pack);
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - (Date.now() - t0))));
      setDone(true);
      setTimeout(() => setDiagnosis(d), 300);
    } catch (e) { setError((e as Error).message); }
  }, [subject, pack, graded, setDiagnosis]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const correct = graded.filter((g) => g.correct).length;

  return (
    <Page className="sm:pt-24">
      <Label>Diagnosis</Label>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Analyzing your answers</h1>
      <p className="mt-1 text-text-2">{correct} of {graded.length} correct. Now finding the idea behind the misses.</p>
      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <Checklist key={attempt} steps={STEPS} stepMs={1100} done={done} />
      </div>
      {error && (
        <div className="mt-4">
          <ErrorBox message={error} onRetry={() => { setAttempt((a) => a + 1); void run(); }} />
        </div>
      )}
    </Page>
  );
}
