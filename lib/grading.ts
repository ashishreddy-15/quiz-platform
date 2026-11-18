// STUB — owned by Agent A (data).
import type { GradedResponse, Question, StudentResponse } from "./schema";
/** Deterministic grading. `ambiguous` = short answer matched neither accepted nor wrong patterns → needs LLM rubric judge. */
export function gradeLocal(q: Question, r: StudentResponse): { graded: GradedResponse; ambiguous: boolean } { throw new Error("todo " + q.id + r.qid); }
