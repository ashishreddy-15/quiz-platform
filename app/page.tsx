"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/lib/store";
import { DiagnosingView } from "@/components/DiagnosingView";
import { DiagnosisView } from "@/components/DiagnosisView";
import { Header } from "@/components/Header";
import { LessonPlayer } from "@/components/LessonPlayer";
import { MasteryCheck } from "@/components/MasteryCheck";
import { QuizRunner } from "@/components/QuizRunner";
import { Report } from "@/components/Report";
import { SubjectPicker } from "@/components/SubjectPicker";
import { TeachBack } from "@/components/TeachBack";

export default function Home() {
  const phase = useSession((s) => s.phase);
  const currentGap = useSession((s) => s.currentGap);
  const diagnosis = useSession((s) => s.diagnosis);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Guard against inconsistent persisted state (e.g. refresh mid-flow)
  const needsGap = phase === "lesson" || phase === "mastery" || phase === "teachback";
  const broken = (needsGap && !currentGap) || ((phase === "diagnosis" || phase === "report") && !diagnosis);
  useEffect(() => {
    if (mounted && broken) useSession.getState().reset();
  }, [mounted, broken]);

  if (!mounted || broken) return <div className="min-h-screen" />;

  const view = {
    pick: <SubjectPicker />, quiz: <QuizRunner />, diagnosing: <DiagnosingView />, diagnosis: <DiagnosisView />,
    lesson: <LessonPlayer />, mastery: <MasteryCheck />, teachback: <TeachBack />, report: <Report />,
  }[phase];

  return (
    <>
      <Header />
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={phase} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
            {view}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
