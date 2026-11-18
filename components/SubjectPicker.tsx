"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { INTERESTS, type Interest } from "@/lib/api-contract";
import type { Subject } from "@/lib/schema";
import { useSession } from "@/lib/store";
import { Button } from "./ui";

const SUBJECTS: { id: Subject; name: string; blurb: string; grad: string; icon: React.ReactNode }[] = [
  { id: "math", name: "Math", blurb: "Fractions, algebra & number sense", grad: "from-indigo-500/25 to-violet-500/10",
    icon: (<svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 24h28M24 10v28" /><circle cx="24" cy="24" r="19" opacity=".35" /></svg>) },
  { id: "physics", name: "Physics", blurb: "Forces, motion & energy", grad: "from-sky-500/25 to-cyan-500/10",
    icon: (<svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="24" cy="24" r="3.5" fill="currentColor" /><ellipse cx="24" cy="24" rx="19" ry="8" /><ellipse cx="24" cy="24" rx="19" ry="8" transform="rotate(60 24 24)" /><ellipse cx="24" cy="24" rx="19" ry="8" transform="rotate(120 24 24)" /></svg>) },
  { id: "chemistry", name: "Chemistry", blurb: "Atoms, bonds & reactions", grad: "from-emerald-500/25 to-teal-500/10",
    icon: (<svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"><path d="M19 6h10M21 6v14L9 40a3 3 0 0 0 2.6 4.5h24.8A3 3 0 0 0 39 40L27 20V6" /><path d="M14 32h20" opacity=".6" /></svg>) },
];
const EMOJI: Record<Interest, string> = { sports: "⚽", gaming: "🎮", cooking: "🍳", music: "🎵", space: "🚀" };

export function SubjectPicker() {
  const start = useSession((s) => s.start);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [interest, setInterest] = useState<Interest>("sports");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl">GapFinder</h1>
        <p className="mt-4 text-xl text-slate-300 sm:text-2xl">Find the why behind every wrong answer.</p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {SUBJECTS.map((s, i) => (
          <motion.button key={s.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
            whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => setSubject(s.id)}
            className={clsx("glass rounded-2xl bg-gradient-to-br p-6 text-left transition", s.grad,
              subject === s.id ? "!border-indigo-400 ring-2 ring-indigo-400/60" : "hover:!border-slate-500")}>
            <div className="text-indigo-200">{s.icon}</div>
            <div className="mt-4 text-2xl font-bold">{s.name}</div>
            <div className="mt-1 text-sm text-slate-400">{s.blurb}</div>
          </motion.button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-10 text-center">
        <p className="text-slate-300">We&apos;ll explain things using what you love</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {INTERESTS.map((i) => (
            <button key={i} onClick={() => setInterest(i)}
              className={clsx("rounded-full border px-4 py-2 text-sm font-medium capitalize transition",
                interest === i ? "border-violet-400 bg-violet-500/25 text-white" : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-500")}>
              {EMOJI[i]} {i}
            </button>
          ))}
        </div>
        <Button className="mt-10 px-10 py-4 text-lg" disabled={!subject} onClick={() => subject && start(subject, interest)}>
          Start the 5-question check →
        </Button>
      </motion.div>
    </div>
  );
}
