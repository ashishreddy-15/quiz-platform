// SHARED CONTRACT — request/response shapes for every route. Frontend and backend both import these.
import type {
  TopicPack,
  Concept, Diagnosis, GapCandidate, GradedResponse, MasteryItem, PublicQuestion, StudentResponse, Subject, TeachbackResult,
} from "./schema";

// GET /api/graph?subject=math
export type GraphRes = { concepts: Concept[] };

// POST /api/generate — AI builds a concept DAG + 5 diagnostic MCQs for ANY topic the user types.
export type GenerateReq = { topic: string; level?: string };
export type GenerateRes = { pack: TopicPack };

// POST /api/quiz — preset topic from the static bank, same shape as generate.
export type QuizReq = { subject: Subject };
export type QuizRes = { pack: TopicPack; questions: PublicQuestion[] }; // questions kept for back-compat

// EVERY request below accepts an optional `pack`. When present, the route uses ONLY the pack's
// concepts/questions (AI topics). When absent, routes fall back to the static bank (scripts/personas.ts).

// POST /api/grade
export type GradeReq = { responses: StudentResponse[]; pack?: TopicPack };
export type GradeRes = { graded: GradedResponse[] };

// POST /api/diagnose
export type DiagnoseReq = { subject: Subject; graded: GradedResponse[]; pack?: TopicPack };
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
  pack?: TopicPack;
};
export const LESSON_HEADINGS = ["The idea", "Why your answer happened", "Analogy", "Worked example", "Try this"] as const;

// POST /api/mastery
export type MasteryReq = { conceptId: string; misconception: string; attempt: number; workedExample?: string; pack?: TopicPack };
export type MasteryRes = { items: MasteryItem[]; fallback?: boolean }; // exactly 3: recall, application, transfer. Graded client-side.

// POST /api/teachback
export type TeachbackReq = { conceptId: string; explanation: string; misconception: string; pack?: TopicPack };
export type TeachbackRes = TeachbackResult;

export const INTERESTS = ["sports", "gaming", "cooking", "music", "space"] as const;
export type Interest = (typeof INTERESTS)[number];

/** Mastery rule: >=2 of 3 correct AND transfer item correct. */
export function isMastered(results: { kind: MasteryItem["kind"]; correct: boolean }[]): boolean {
  const n = results.filter((r) => r.correct).length;
  return n >= 2 && results.some((r) => r.kind === "transfer" && r.correct);
}
export const MAX_RETEACH = 2;

/** Suggested topics shown as chips under the topic input. Presets map to the static bank (instant, offline-safe). */
export const SUGGESTED_TOPICS: { label: string; preset?: "math" | "physics" | "chemistry" }[] = [
  { label: "Adding fractions", preset: "math" },
  { label: "Motion and forces", preset: "physics" },
  { label: "Atoms and reactions", preset: "chemistry" },
  { label: "Photosynthesis" },
  { label: "Linear equations" },
  { label: "Supply and demand" },
];
