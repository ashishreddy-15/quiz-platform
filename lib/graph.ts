// STUB — owned by Agent A (data). Signatures are the contract; bodies to be implemented.
import type { Concept, ConceptGraph, GapCandidate, GradedResponse, PublicQuestion, Question, Subject } from "./schema";
export function getGraph(): ConceptGraph { throw new Error("todo"); }
export function getConcept(id: string): Concept | undefined { throw new Error("todo " + id); }
export function conceptsForSubject(subject: Subject): Concept[] { throw new Error("todo " + subject); }
/** All transitive prerequisites of a concept (excluding itself), nearest first. */
export function ancestors(id: string): string[] { throw new Error("todo " + id); }
export function getQuestion(id: string): Question | undefined { throw new Error("todo " + id); }
/** 5 questions for the subject, spread across distinct concept branches, easy→hard. */
export function sampleQuiz(subject: Subject, n = 5): Question[] { throw new Error("todo " + subject + n); }
export function toPublic(q: Question): PublicQuestion { throw new Error("todo " + q.id); }
/** Heuristic root-gap candidates from wrong answers, highest score first (max 5). */
export function scoreGaps(graded: GradedResponse[]): GapCandidate[] { throw new Error("todo " + graded.length); }
