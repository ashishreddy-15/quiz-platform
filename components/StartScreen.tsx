"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { INTERESTS, SUGGESTED_TOPICS, type Interest } from "@/lib/api-contract";
import { generate, getQuiz } from "@/lib/client-api";
import type { TopicPack } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { IconArrowRight, Spinner } from "./icons";
import { Button, Checklist, ErrorBox, Label, Page, Segmented } from "./ui";

const LEVELS = ["Middle school", "High school", "College"] as const;
type Level = (typeof LEVELS)[number];
const GEN_STEPS = ["Mapping prerequisite concepts", "Writing 5 diagnostic questions", "Tagging likely misconceptions"];

type Status = { kind: "idle" } | { kind: "loading"; topic: string; ai: boolean } | { kind: "done"; topic: string } | { kind: "error"; topic: string; message: string };

export function StartScreen() {
  const start = useSession((s) => s.start);
  const setPack = useSession((s) => s.setPack);
  const storedInterest = useSession((s) => s.interest);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("High school");
  const [interest, setInterest] = useState<Interest>(storedInterest);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const ac = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => ac.current?.abort(), []);

  const launch = (pack: TopicPack) => {
    if (!pack?.questions?.length) throw new Error("The quiz came back empty. Try again or pick another topic.");
    start(pack.subject, interest);
    setPack(pack);
  };

  const run = async (raw: string, preset?: string) => {
    const t = raw.trim();
    if (!t || status.kind === "loading") return;
    ac.current?.abort();
    const ctrl = new AbortController();
    ac.current = ctrl;
    setTopic(t);
    setStatus({ kind: "loading", topic: t, ai: !preset });
    try {
      const pack = preset ? (await getQuiz(preset, ctrl.signal)).pack : (await generate(t, level, ctrl.signal)).pack;
      if (ctrl.signal.aborted) return;
      if (preset) { launch(pack); return; }
      setStatus({ kind: "done", topic: t });
      await new Promise((r) => setTimeout(r, 350));
      if (!ctrl.signal.aborted) launch(pack);
    } catch (e) {
      if ((e as Error).name === "AbortError" || ctrl.signal.aborted) return;
      setStatus({ kind: "error", topic: t, message: (e as Error).message || "Couldn't generate a quiz." });
    }
  };

  const cancel = () => {
    ac.current?.abort();
    setStatus({ kind: "idle" });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const busy = status.kind === "loading" || status.kind === "done";

  if (busy && (status.kind === "done" || status.ai)) {
    return (
      <Page className="sm:pt-24">
        <Label>Generating quiz</Label>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{status.topic}</h1>
        <p className="mt-1 text-text-2">{level} · examples from {interest}</p>
        <div className="mt-8 rounded-lg border border-border bg-surface p-5">
          <Checklist steps={GEN_STEPS} stepMs={2500} done={status.kind === "done"} />
        </div>
        <p className="mt-4 text-[13px] text-text-3">
          This usually takes 5–10 seconds.{" "}
          <button onClick={cancel} className="text-text-2 underline decoration-border-strong underline-offset-2 hover:text-text">Cancel</button>
        </p>
      </Page>
    );
  }

  return (
    <Page className="sm:pt-24">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">What do you want to learn?</h1>
      <p className="mt-2 text-[15px] text-text-2">Type any topic. We&apos;ll ask 5 quick questions, find the idea you&apos;re missing, and teach it.</p>

      <form className="mt-8" onSubmit={(e) => { e.preventDefault(); void run(topic); }}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="topic">Topic</label>
          <input id="topic" ref={inputRef} autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80}
            placeholder="e.g. Photosynthesis or Newton&apos;s laws" autoComplete="off" disabled={busy}
            className="h-11 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3.5 text-[15px] text-text outline-none transition-colors placeholder:text-text-3 focus:border-accent" />
          <Button type="submit" size="lg" className="h-11 sm:px-5" disabled={!topic.trim() || busy}>
            Generate quiz {busy ? <Spinner /> : <IconArrowRight />}
          </Button>
        </div>
      </form>

      {status.kind === "error" && (
        <div className="mt-4">
          <ErrorBox message={status.message} onRetry={() => void run(status.topic)}>
            <span className="text-[13px] text-text-3">or try one of the suggestions below.</span>
          </ErrorBox>
        </div>
      )}

      <div className="mt-6 divide-y divide-border rounded-lg border border-border">
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[13px] text-text-2">Level</span>
          <Segmented className="sm:w-[340px]" label="Level" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
        </div>
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[13px] text-text-2">Explain with examples from</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Examples from">
            {INTERESTS.map((i) => (
              <button key={i} role="radio" aria-checked={interest === i} onClick={() => setInterest(i)}
                className={clsx("h-7 rounded-md border px-2.5 text-[13px] font-medium capitalize transition-colors duration-150",
                  interest === i ? "border-accent bg-accent/10 text-text" : "border-border text-text-2 hover:border-border-strong hover:text-text")}>
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <Label className="mb-3">Try a suggestion</Label>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((s) => (
            <button key={s.label} disabled={busy} onClick={() => void run(s.label, s.preset)}
              className="group inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] text-text-2 transition-colors duration-150 hover:border-border-strong hover:text-text disabled:opacity-50">
              {status.kind === "loading" && status.topic === s.label ? <Spinner size={12} /> : null}
              {s.label}
              {s.preset && <span className="text-[11px] text-text-3">instant</span>}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {[
          ["1", "Answer 5 questions", "Tell us how sure you are. No grades."],
          ["2", "See the root cause", "We trace mistakes to the idea underneath."],
          ["3", "Learn and check", "A short lesson, then 3 questions to confirm."],
        ].map(([n, t, d]) => (
          <li key={n} className="bg-bg p-4">
            <div className="text-[12px] tabular-nums text-text-3">{n}</div>
            <div className="mt-1 font-medium">{t}</div>
            <div className="mt-0.5 text-[13px] text-text-2">{d}</div>
          </li>
        ))}
      </ol>
    </Page>
  );
}
