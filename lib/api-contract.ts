// SHARED CONTRACT — request/response shapes for every route. Frontend and backend both import these.
import type {
  Concept, Diagnosis, GapCandidate, GradedResponse, MasteryItem, PublicQuestion, StudentResponse, Subject, TeachbackResult,
} from "./schema";

// GET /api/graph?subject=math
export type GraphRes = { concepts: Concept[] };

// POST /api/quiz
export type QuizReq = { subject: Subject };
export type QuizRes = { questions: PublicQuestion[] }; // exactly 5

// POST /api/grade
export type GradeReq = { responses: StudentResponse[] };
export type GradeRes = { graded: GradedResponse[] };

// POST /api/diagnose
export type DiagnoseReq = { subject: Subject; graded: GradedResponse[] };
export type DiagnoseRes = Diagnosis & { heuristic: GapCandidate[]; fallback?: boolean };

// POST /api/lesson  → response body is a STREAM of UTF-8 markdown text (not JSON, not SSE framing).
// Markdown uses exactly these H2 headings in order:
//   "## The idea", "## Why your answer happened", "## Analogy", "## Worked example", "## Try this"
// Header "x-fallback: 1" when served from data/fallback.
export type LessonReq = {
  conceptId: string;
  misconception: string;
  wrongAnswer: string;
  stem: string;
  interest: string;
  attempt: number; // 1-based
  previousAnalogy?: string;
};
export const LESSON_HEADINGS = ["The idea", "Why your answer happened", "Analogy", "Worked example", "Try this"] as const;

// POST /api/mastery
export type MasteryReq = { conceptId: string; misconception: string; attempt: number; workedExample?: string };
export type MasteryRes = { items: MasteryItem[]; fallback?: boolean }; // exactly 3: recall, application, transfer. Graded client-side.

// POST /api/teachback
export type TeachbackReq = { conceptId: string; explanation: string; misconception: string };
export type TeachbackRes = TeachbackResult;

export const INTERESTS = ["sports", "gaming", "cooking", "music", "space"] as const;
export type Interest = (typeof INTERESTS)[number];

/** Mastery rule: >=2 of 3 correct AND transfer item correct. */
export function isMastered(results: { kind: MasteryItem["kind"]; correct: boolean }[]): boolean {
  const n = results.filter((r) => r.correct).length;
  return n >= 2 && results.some((r) => r.kind === "transfer" && r.correct);
}
export const MAX_RETEACH = 2;
