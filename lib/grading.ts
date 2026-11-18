import type { GradedResponse, Question, StudentResponse } from "./schema";

function matches(pattern: string, text: string): boolean {
  try { return new RegExp(pattern, "i").test(text); } catch { return false; }
}

/** Deterministic grading. `ambiguous` = short answer matched neither accepted nor wrong patterns → needs LLM rubric judge. */
export function gradeLocal(q: Question, r: StudentResponse): { graded: GradedResponse; ambiguous: boolean } {
  const base = { ...r, stem: q.stem, explanation: q.explanation, concepts: q.concepts };
  if (q.type === "mcq") {
    const opts = q.options ?? [];
    const chosen = opts.find((o) => o.id === r.answer);
    const correctOpt = opts.find((o) => o.id === q.answer);
    const correct = r.answer === q.answer;
    return {
      graded: { ...base, correct, misconception: correct ? null : chosen?.misconception ?? null, chosenText: chosen?.text ?? r.answer, correctText: correctOpt?.text ?? q.answer },
      ambiguous: false,
    };
  }
  const text = r.answer.trim().toLowerCase();
  const mk = (correct: boolean, misconception: string | null) => ({ ...base, correct, misconception, chosenText: r.answer, correctText: q.answer });
  if ((q.accepted_patterns ?? []).some((p) => matches(p, text))) return { graded: mk(true, null), ambiguous: false };
  const wrong = (q.common_wrong ?? []).find((w) => matches(w.pattern, text));
  if (wrong) return { graded: mk(false, wrong.misconception), ambiguous: false };
  return { graded: mk(false, null), ambiguous: true };
}
