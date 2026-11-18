// SHARED CONTRACT — do not edit without coordinating. Zod schemas are the single source of truth; types derive from them.
import { z } from "zod";

export const SubjectSchema = z.enum(["math", "physics", "chemistry"]);
export type Subject = z.infer<typeof SubjectSchema>;

export const ConceptSchema = z.object({
  id: z.string(), // e.g. "math.frac.equivalence"
  subject: SubjectSchema,
  name: z.string(),
  description: z.string(),
  prerequisites: z.array(z.string()), // concept ids
  grade: z.number().int(),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const ConceptGraphSchema = z.object({
  subjects: z.array(SubjectSchema),
  concepts: z.array(ConceptSchema),
});
export type ConceptGraph = z.infer<typeof ConceptGraphSchema>;

export const OptionSchema = z.object({
  id: z.string(), // "a".."d"
  text: z.string(),
  misconception: z.string().nullable(), // snake_case tag; null for the correct option
});
export type Option = z.infer<typeof OptionSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  subject: SubjectSchema,
  type: z.enum(["mcq", "short"]),
  difficulty: z.number().int().min(1).max(3),
  stem: z.string(),
  concepts: z.array(z.string()).min(1),
  options: z.array(OptionSchema).optional(), // required for mcq
  answer: z.string(), // option id for mcq; canonical text for short
  accepted_patterns: z.array(z.string()).optional(), // regex strings (case-insensitive) for short
  common_wrong: z.array(z.object({ pattern: z.string(), misconception: z.string() })).optional(),
  rubric: z.string().optional(),
  explanation: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuestionBankSchema = z.object({
  version: z.number(),
  questions: z.array(QuestionSchema),
});

/** Question as sent to the browser: no answer key. */
export type PublicQuestion = Omit<Question, "answer" | "accepted_patterns" | "common_wrong" | "rubric" | "explanation"> & {
  options?: { id: string; text: string }[];
};

export const ResponseSchema = z.object({
  qid: z.string(),
  answer: z.string(), // option id or free text
  confidence: z.number().min(0).max(1),
  timeMs: z.number(),
  rationale: z.string().optional(),
});
export type StudentResponse = z.infer<typeof ResponseSchema>;

export const GradedResponseSchema = ResponseSchema.extend({
  correct: z.boolean(),
  misconception: z.string().nullable(), // tag of the chosen distractor / matched wrong pattern
  stem: z.string(),
  chosenText: z.string(),
  correctText: z.string(),
  explanation: z.string(),
  concepts: z.array(z.string()),
  feedback: z.string().optional(),
});
export type GradedResponse = z.infer<typeof GradedResponseSchema>;

export const GapCandidateSchema = z.object({
  concept: z.string(),
  evidence_count: z.number(),
  score: z.number(),
  explains_qids: z.array(z.string()),
});
export type GapCandidate = z.infer<typeof GapCandidateSchema>;

export const DiagnosisSchema = z.object({
  per_question: z.array(
    z.object({
      qid: z.string(),
      error_type: z.enum(["misconception", "slip", "guess", "correct"]),
      misconception: z.string(), // plain-language description
      evidence: z.string(),
    }),
  ),
  root_gaps: z
    .array(
      z.object({
        concept_id: z.string(),
        confidence: z.number().min(0).max(1),
        explains_qids: z.array(z.string()),
        reasoning: z.string(),
        student_facing_summary: z.string(),
      }),
    )
    .max(3),
  strengths: z.array(z.string()),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const MasteryItemSchema = z.object({
  kind: z.enum(["recall", "application", "transfer"]),
  stem: z.string(),
  options: z.array(OptionSchema).length(4),
  answer: z.string(), // option id
  explanation: z.string(),
});
export type MasteryItem = z.infer<typeof MasteryItemSchema>;
export const MasteryItemsSchema = z.object({ items: z.array(MasteryItemSchema).length(3) });

export const TeachbackResultSchema = z.object({
  accuracy: z.number().min(0).max(10),
  completeness: z.number().min(0).max(10),
  misconception_present: z.boolean(),
  score: z.number().min(0).max(100),
  tip: z.string(),
});
export type TeachbackResult = z.infer<typeof TeachbackResultSchema>;

export const ShortGradeSchema = z.object({
  correct: z.boolean(),
  partial_credit: z.number().min(0).max(1),
  feedback: z.string(),
});
