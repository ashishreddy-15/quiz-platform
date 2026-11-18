// Offline mocks (NEXT_PUBLIC_MOCK=1): math-fractions scenario so the UI works without the backend.
import type {
  DiagnoseRes, GradeRes, GraphRes, LessonReq, MasteryReq, MasteryRes, QuizRes, TeachbackReq, TeachbackRes,
} from "./api-contract";
import type { Concept, GradedResponse, PublicQuestion, StudentResponse, Subject } from "./schema";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const c = (id: string, name: string, prerequisites: string[], grade: number, description = ""): Concept => ({
  id: `math.frac.${id}`, subject: "math", name, description, prerequisites: prerequisites.map((p) => `math.frac.${p}`), grade,
});
const CONCEPTS: Concept[] = [
  c("meaning", "Fractions as parts", [], 3),
  c("equivalence", "Equivalent fractions", ["meaning"], 4),
  c("compare", "Comparing fractions", ["equivalence"], 4),
  c("simplify", "Simplifying fractions", ["equivalence"], 5),
  c("addlike", "Adding like denominators", ["meaning"], 4),
  c("addunlike", "Adding unlike denominators", ["equivalence", "addlike"], 5),
  c("mixed", "Mixed numbers", ["addlike", "simplify"], 5),
  c("multiply", "Multiplying fractions", ["simplify", "addunlike"], 6),
];

// PublicQuestion.options is typed (via intersection) as still requiring `misconception`; mock casts it away.
const QUESTIONS = ([
  { id: "q1", subject: "math", type: "mcq", difficulty: 1, stem: "Which fraction is equal to $\\frac{1}{2}$?", concepts: ["math.frac.equivalence"], key: "b",
    options: [{ id: "a", text: "$\\frac{2}{3}$" }, { id: "b", text: "$\\frac{3}{6}$" }, { id: "c", text: "$\\frac{1}{4}$" }, { id: "d", text: "$\\frac{2}{3}$ of 6" }],
    wrong: { a: "adds_to_num_and_den", c: "bigger_den_means_bigger" } },
  { id: "q2", subject: "math", type: "mcq", difficulty: 2, stem: "Which is larger, $\\frac{3}{4}$ or $\\frac{2}{3}$?", concepts: ["math.frac.compare", "math.frac.equivalence"], key: "a",
    options: [{ id: "a", text: "$\\frac{3}{4}$" }, { id: "b", text: "$\\frac{2}{3}$" }, { id: "c", text: "They are equal" }, { id: "d", text: "Can't tell" }],
    wrong: { b: "compares_numerators_only", c: "compares_numerators_only" } },
  { id: "q3", subject: "math", type: "mcq", difficulty: 2, stem: "What is $\\frac{1}{3} + \\frac{1}{4}$?", concepts: ["math.frac.addunlike"], key: "c",
    options: [{ id: "a", text: "$\\frac{2}{7}$" }, { id: "b", text: "$\\frac{2}{12}$" }, { id: "c", text: "$\\frac{7}{12}$" }, { id: "d", text: "$\\frac{1}{7}$" }],
    wrong: { a: "adds_across", b: "adds_across", d: "adds_across" } },
  { id: "q4", subject: "math", type: "short", difficulty: 2, stem: "Simplify $\\frac{6}{8}$ as far as possible.", concepts: ["math.frac.simplify"], key: "3/4", wrong: {} },
  { id: "q5", subject: "math", type: "mcq", difficulty: 1, stem: "A pizza is cut into 8 equal slices and you eat 3. What fraction did you eat?", concepts: ["math.frac.meaning"], key: "d",
    options: [{ id: "a", text: "$\\frac{3}{5}$" }, { id: "b", text: "$\\frac{8}{3}$" }, { id: "c", text: "$\\frac{5}{8}$" }, { id: "d", text: "$\\frac{3}{8}$" }],
    wrong: { a: "part_to_part", b: "inverted", c: "counts_remaining" } },
] as unknown) as (PublicQuestion & { key: string; wrong: Record<string, string> })[];

export async function getGraph(subject: Subject): Promise<GraphRes> {
  void subject;
  await sleep(250);
  return { concepts: CONCEPTS };
}
export async function getQuiz(subject: Subject): Promise<QuizRes> {
  void subject;
  await sleep(500);
  return { questions: QUESTIONS.map((q) => { const o = { ...q } as Partial<typeof q>; delete o.key; delete o.wrong; return o as PublicQuestion; }) };
}
export async function grade(responses: StudentResponse[]): Promise<GradeRes> {
  await sleep(400);
  const graded: GradedResponse[] = responses.map((r) => {
    const q = QUESTIONS.find((x) => x.id === r.qid)!;
    const correct = q.type === "short" ? r.answer.replace(/\s/g, "") === q.key : r.answer === q.key;
    const text = (id: string) => q.options?.find((o) => o.id === id)?.text ?? id;
    return {
      ...r, correct, misconception: correct ? null : q.wrong[r.answer] ?? "unknown_error", stem: q.stem,
      chosenText: q.type === "short" ? r.answer : text(r.answer), correctText: q.type === "short" ? q.key : text(q.key),
      explanation: "Mock explanation.", concepts: q.concepts,
    };
  });
  return { graded };
}
export async function diagnose(subject: Subject, graded: GradedResponse[]): Promise<DiagnoseRes> {
  void subject;
  await sleep(1800);
  const wrong = graded.filter((g) => !g.correct);
  const strengths = [...new Set(graded.filter((g) => g.correct).flatMap((g) => g.concepts))];
  const root = wrong.length > 0;
  return {
    per_question: graded.map((g) => ({
      qid: g.qid,
      error_type: g.correct ? "correct" : g.confidence < 0.35 ? "guess" : "misconception",
      misconception: g.correct ? "" : "Treats numerator and denominator as independent whole numbers",
      evidence: g.correct ? "Correct answer." : `Chose "${g.chosenText}" with ${Math.round(g.confidence * 100)}% confidence.`,
    })),
    root_gaps: root
      ? [{
          concept_id: "math.frac.equivalence", confidence: 0.86, explains_qids: wrong.map((w) => w.qid),
          reasoning: "Several wrong answers share one pattern: fractions are handled as two separate whole numbers, which points to a missing idea of equivalent fractions (same amount, different names).",
          student_facing_summary: "You treat the top and bottom numbers as separate counts, so different-looking fractions never feel like the same amount.",
        }]
      : [],
    strengths: strengths.filter((s) => !(root && s === "math.frac.equivalence")),
    heuristic: [], fallback: false,
  };
}
export async function streamLesson(req: LessonReq, onChunk: (t: string) => void, signal?: AbortSignal) {
  const text = `## The idea
Equivalent fractions name the **same amount** in different pieces. $\\frac{1}{2}=\\frac{3}{6}$ because multiplying top and bottom by the same number just cuts each piece smaller.

## Why your answer happened
You picked "${req.wrongAnswer}". That treats the top and bottom as separate numbers, so adding the same number to both *seems* fine. It changes the amount.

## Analogy
Think of ${req.interest}: a scoreboard showing 1 of 2 shots made is the same rate as 3 of 6. Doubling the attempts and the makes together keeps the percentage fixed${req.previousAnalogy ? " (a fresh angle from last time!)" : ""}.

## Worked example
Is $\\frac{2}{3}$ equal to $\\frac{4}{6}$? Multiply top and bottom by $2$: $\\frac{2\\cdot 2}{3\\cdot 2}=\\frac{4}{6}$. Yes.

## Try this
Find a fraction equal to $\\frac{3}{5}$ with denominator $20$.

<details><summary>Show answer</summary>Multiply by $4$: $\\frac{12}{20}$.</details>
`;
  let i = 0;
  await new Promise<void>((resolve, reject) => {
    const t = setInterval(() => {
      if (signal?.aborted) { clearInterval(t); reject(new DOMException("Aborted", "AbortError")); return; }
      i = Math.min(text.length, i + 6);
      onChunk(text.slice(0, i));
      if (i >= text.length) { clearInterval(t); resolve(); }
    }, 25);
  });
  return { text, fallback: false };
}
export async function getMastery(req: MasteryReq): Promise<MasteryRes> {
  void req;
  await sleep(900);
  const opt = (a: string, b: string, cc: string, d: string) => [
    { id: "a", text: a, misconception: null }, { id: "b", text: b, misconception: "adds_to_num_and_den" },
    { id: "c", text: cc, misconception: "bigger_den_means_bigger" }, { id: "d", text: d, misconception: "adds_across" },
  ];
  return {
    items: [
      { kind: "recall", stem: "Equivalent fractions represent...", answer: "a", explanation: "Same amount, different names.",
        options: opt("The same amount", "The same numerator", "The same denominator", "Different amounts") },
      { kind: "application", stem: "Which equals $\\frac{2}{5}$?", answer: "b", explanation: "Multiply both by 2: 4/10.",
        options: [{ id: "a", text: "$\\frac{3}{6}$", misconception: "adds_to_num_and_den" }, { id: "b", text: "$\\frac{4}{10}$", misconception: null },
          { id: "c", text: "$\\frac{2}{10}$", misconception: "bigger_den_means_bigger" }, { id: "d", text: "$\\frac{5}{2}$", misconception: "inverted" }] },
      { kind: "transfer", stem: "A team makes 4 of 8 shots, another 9 of 18. Who shoots better?", answer: "c", explanation: "Both are 1/2: equal.",
        options: [{ id: "a", text: "First team", misconception: "bigger_den_means_bigger" }, { id: "b", text: "Second team", misconception: "bigger_den_means_bigger" },
          { id: "c", text: "They are equal", misconception: null }, { id: "d", text: "Not enough info", misconception: "unknown_error" }] },
    ],
    fallback: false,
  };
}
export async function teachback(r: TeachbackReq): Promise<TeachbackRes> {
  await sleep(1200);
  const words = r.explanation.trim().split(/\s+/).length;
  const score = Math.min(95, 35 + words * 3);
  return { accuracy: Math.min(9, 4 + words / 6), completeness: Math.min(9, 3 + words / 8), misconception_present: words < 8, score,
    tip: "Try adding a concrete example, like cutting a pizza into more slices." };
}
