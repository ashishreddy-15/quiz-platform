// SHARED CONTRACT — client session store + phase state machine.
"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DiagnoseRes, Interest } from "./api-contract";
import type { GradedResponse, MasteryItem, PublicQuestion, StudentResponse, Subject, TeachbackResult } from "./schema";

export type Phase = "pick" | "quiz" | "diagnosing" | "diagnosis" | "lesson" | "mastery" | "teachback" | "report";

export type MasteryStatus = "unknown" | "gap" | "learning" | "mastered" | "needs_teacher";
export type ConceptProgress = {
  status: MasteryStatus;
  attempts: number; // lessons delivered
  lastScore?: number; // 0..3 mastery items correct
  analogies: string[]; // analogy summaries used, to avoid repeats
  teachback?: TeachbackResult;
};

export type SessionState = {
  sessionId: string;
  phase: Phase;
  subject: Subject | null;
  interest: Interest;
  questions: PublicQuestion[];
  responses: StudentResponse[];
  graded: GradedResponse[];
  diagnosis: DiagnoseRes | null;
  gapQueue: string[]; // concept ids, priority order
  currentGap: string | null;
  progress: Record<string, ConceptProgress>;
  currentLesson: string; // full markdown of the current lesson
  masteryItems: MasteryItem[];
  // actions
  start: (subject: Subject, interest: Interest) => void;
  setQuestions: (q: PublicQuestion[]) => void;
  answer: (r: StudentResponse) => void;
  setGraded: (g: GradedResponse[]) => void;
  setDiagnosis: (d: DiagnoseRes) => void;
  beginGap: (conceptId: string) => void;
  setLesson: (md: string) => void;
  setMasteryItems: (items: MasteryItem[]) => void;
  recordMastery: (conceptId: string, score: number, mastered: boolean, analogy?: string) => void;
  recordTeachback: (conceptId: string, r: TeachbackResult) => void;
  nextGap: () => void; // advances queue; goes to "report" when empty
  setPhase: (p: Phase) => void;
  reset: () => void;
};

const initial = {
  phase: "pick" as Phase,
  subject: null,
  interest: "sports" as Interest,
  questions: [],
  responses: [],
  graded: [],
  diagnosis: null,
  gapQueue: [],
  currentGap: null,
  progress: {},
  currentLesson: "",
  masteryItems: [],
};

const newId = () => Math.random().toString(36).slice(2, 10);

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: newId(),
      ...initial,
      start: (subject, interest) => set({ ...initial, sessionId: newId(), subject, interest, phase: "quiz" }),
      setQuestions: (questions) => set({ questions, responses: [] }),
      answer: (r) => set({ responses: [...get().responses.filter((x) => x.qid !== r.qid), r] }),
      setGraded: (graded) => set({ graded, phase: "diagnosing" }),
      setDiagnosis: (d) => {
        const progress: Record<string, ConceptProgress> = { ...get().progress };
        for (const g of d.root_gaps) progress[g.concept_id] = { status: "gap", attempts: 0, analogies: [] };
        for (const s of d.strengths) progress[s] ??= { status: "mastered", attempts: 0, analogies: [] };
        set({ diagnosis: d, gapQueue: d.root_gaps.map((g) => g.concept_id), progress, phase: "diagnosis" });
      },
      beginGap: (conceptId) => {
        const p = get().progress[conceptId] ?? { status: "gap", attempts: 0, analogies: [] };
        set({
          currentGap: conceptId,
          currentLesson: "",
          masteryItems: [],
          phase: "lesson",
          progress: { ...get().progress, [conceptId]: { ...p, status: "learning", attempts: p.attempts + 1 } },
        });
      },
      setLesson: (currentLesson) => set({ currentLesson }),
      setMasteryItems: (masteryItems) => set({ masteryItems }),
      recordMastery: (conceptId, score, mastered, analogy) => {
        const p = get().progress[conceptId];
        const status: MasteryStatus = mastered ? "mastered" : p.attempts > 2 ? "needs_teacher" : "learning";
        set({
          progress: {
            ...get().progress,
            [conceptId]: { ...p, status, lastScore: score, analogies: analogy ? [...p.analogies, analogy] : p.analogies },
          },
        });
      },
      recordTeachback: (conceptId, r) =>
        set({ progress: { ...get().progress, [conceptId]: { ...get().progress[conceptId], teachback: r } } }),
      nextGap: () => {
        const [, ...rest] = get().gapQueue;
        if (rest.length === 0) set({ gapQueue: [], currentGap: null, phase: "report" });
        else set({ gapQueue: rest, currentGap: null, phase: "diagnosis" });
      },
      setPhase: (phase) => set({ phase }),
      reset: () => set({ ...initial, sessionId: newId() }),
    }),
    { name: "gapfinder-session" },
  ),
);
