import conceptsJson from "../data/concepts.json";
import bankJson from "../data/question-bank.json";
import {
  ConceptGraphSchema, QuestionBankSchema,
  type Concept, type ConceptGraph, type GapCandidate, type GradedResponse, type PublicQuestion, type Question, type Subject,
} from "./schema";

const graph: ConceptGraph = ConceptGraphSchema.parse(conceptsJson);
const bank = QuestionBankSchema.parse(bankJson);
const conceptById = new Map<string, Concept>(graph.concepts.map((c) => [c.id, c]));
const questionById = new Map<string, Question>(bank.questions.map((q) => [q.id, q]));

const ancestorCache = new Map<string, string[]>();
// descendant count per concept (how many concepts build on it) — used as a small "closer to root" bonus
const descendantCount = new Map<string, number>();
for (const c of graph.concepts) for (const a of ancestorsOf(c.id)) descendantCount.set(a, (descendantCount.get(a) ?? 0) + 1);

function ancestorsOf(id: string): string[] {
  const hit = ancestorCache.get(id);
  if (hit) return hit;
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const p of conceptById.get(f)?.prerequisites ?? []) {
        if (seen.has(p)) continue;
        seen.add(p);
        out.push(p);
        next.push(p);
      }
    }
    frontier = next;
  }
  ancestorCache.set(id, out);
  return out;
}

export function getGraph(): ConceptGraph { return graph; }
export function getConcept(id: string): Concept | undefined { return conceptById.get(id); }
export function conceptsForSubject(subject: Subject): Concept[] { return graph.concepts.filter((c) => c.subject === subject); }
/** All transitive prerequisites of a concept (excluding itself), nearest first. */
export function ancestors(id: string): string[] { return [...ancestorsOf(id)]; }
export function getQuestion(id: string): Question | undefined { return questionById.get(id); }

/** n questions for the subject, spread across distinct concept branches, easy→hard. */
export function sampleQuiz(subject: Subject, n = 5): Question[] {
  const pool = bank.questions.filter((q) => q.subject === subject);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked: Question[] = [];
  const covered = new Set<string>();
  while (picked.length < Math.min(n, pool.length)) {
    let best: Question | undefined;
    let bestNew = -1;
    for (const q of shuffled) {
      if (picked.includes(q)) continue;
      const fresh = q.concepts.filter((c) => !covered.has(c)).length;
      if (fresh > bestNew) { best = q; bestNew = fresh; }
    }
    if (!best) break;
    picked.push(best);
    best.concepts.forEach((c) => covered.add(c));
  }
  return picked.sort((a, b) => a.difficulty - b.difficulty);
}

export function toPublic(q: Question): PublicQuestion {
  const pub: PublicQuestion = {
    id: q.id, subject: q.subject, type: q.type, difficulty: q.difficulty, stem: q.stem, concepts: q.concepts,
  };
  if (q.options) (pub as { options?: { id: string; text: string }[] }).options = q.options.map((o) => ({ id: o.id, text: o.text }));
  return pub;
}

const weight = (g: GradedResponse) => 0.5 + 0.5 * g.confidence;

/**
 * Heuristic root-gap candidates. Each wrong answer votes (weight 0.5..1.0 by confidence) for its
 * concepts and all their prerequisites; a correct answer that directly tests a concept subtracts
 * 0.6x its weight; a direct-test bonus (+0.1) favors the most specific suspect and a tiny tie-break bonus favors concepts many others build on.
 */
export function scoreGaps(graded: GradedResponse[]): GapCandidate[] {
  const acc = new Map<string, { score: number; qids: string[] }>();
  for (const g of graded) {
    if (g.correct) continue;
    const cands = new Set<string>();
    for (const c of g.concepts) {
      if (!conceptById.has(c)) continue;
      cands.add(c);
      ancestorsOf(c).forEach((a) => cands.add(a));
    }
    for (const c of cands) {
      const e = acc.get(c) ?? { score: 0, qids: [] };
      e.score += weight(g) + (g.concepts.includes(c) ? 0.1 : 0); // directly-tested concept: most specific suspect
      e.qids.push(g.qid);
      acc.set(c, e);
    }
  }
  const out: GapCandidate[] = [];
  for (const [concept, e] of acc) {
    let score = e.score + 0.005 * Math.min(descendantCount.get(concept) ?? 0, 9);
    for (const g of graded) if (g.correct && g.concepts.includes(concept)) score -= 0.6 * weight(g);
    out.push({ concept, evidence_count: e.qids.length, score: Math.round(score * 100) / 100, explains_qids: e.qids });
  }
  return out.sort((a, b) => b.score - a.score || b.evidence_count - a.evidence_count || a.concept.localeCompare(b.concept)).slice(0, 5);
}
