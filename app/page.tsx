"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/lib/store";
import { DiagnosingView } from "@/components/DiagnosingView";
import { DiagnosisView } from "@/components/DiagnosisView";
import { LessonPlayer } from "@/components/LessonPlayer";
import { MasteryCheck } from "@/components/MasteryCheck";
import { QuizRunner } from "@/components/QuizRunner";
import { Report } from "@/components/Report";
import { StartScreen } from "@/components/StartScreen";
import { TeachBack } from "@/components/TeachBack";
import { TopBar } from "@/components/TopBar";

export default function Home() {
  const phase = useSession((s) => s.phase);
  const currentGap = useSession((s) => s.currentGap);
  const diagnosis = useSession((s) => s.diagnosis);
  const questions = useSession((s) => s.questions);
  const graded = useSession((s) => s.graded);
  const pack = useSession((s) => s.pack);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Guard against inconsistent persisted state (e.g. a refresh mid-generation).
  const needsGap = phase === "lesson" || phase === "mastery" || phase === "teachback";
  const broken =
    (phase !== "pick" && !pack) ||
    (phase === "quiz" && questions.length === 0) ||
    (phase === "diagnosing" && graded.length === 0) ||
    (needsGap && !currentGap) ||
    ((phase === "diagnosis" || phase === "report") && !diagnosis);
  useEffect(() => {
    if (mounted && broken) useSession.getState().reset();
  }, [mounted, broken]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [phase, currentGap]);

  if (!mounted || broken) return <div className="min-h-screen bg-bg" />;

  const view = {
    pick: <StartScreen />, quiz: <QuizRunner />, diagnosing: <DiagnosingView />, diagnosis: <DiagnosisView />,
    lesson: <LessonPlayer />, mastery: <MasteryCheck />, teachback: <TeachBack />, report: <Report />,
  }[phase];

  return (
    <div className="min-h-screen bg-bg">
      <TopBar />
      <main>
        {/* Enter-only fade: no exit animation, so a leaving screen never re-renders with the next phase's state. */}
        <motion.div key={`${phase}-${currentGap ?? ""}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, ease: "easeOut" }}>
          {view}
        </motion.div>
      </main>
    </div>
  );
}
