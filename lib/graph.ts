import conceptsJson from "../data/concepts.json";
import bankJson from "../data/question-bank.json";
import {
  ConceptGraphSchema, QuestionBankSchema,
  type Concept, type ConceptGraph, type TopicPack, type GapCandidate, type GradedResponse, type PublicQuestion, type Question, type Subject,
} from "./schema";

const graph: ConceptGraph = ConceptGraphSchema.parse(conceptsJson);
const bank = QuestionBankSchema.parse(bankJson);

export type Graph = ReturnType<typeof makeGraph>;

/** Build a graph instance over any concept/question set (static bank or an AI TopicPack). */
export function makeGraph(concepts: Concept[], questions: Question[]) {
  const conceptById = new Map<string, Concept>(concepts.map((c) => [c.id, c]));
  const questionById = new Map<string, Question>(questions.map((q) => [q.id, q]));
  const ancestorCache = new Map<string, string[]>();
  const descendantCount = new Map<string, number>();

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
  for (const c of concepts) for (const a of ancestorsOf(c.id)) descendantCount.set(a, (descendantCount.get(a) ?? 0) + 1);

  const getConcept = (id: string) => conceptById.get(id);
  const getQuestion = (id: string) => questionById.get(id);
  const ancestors = (id: string): string[] => [...ancestorsOf(id)];

  /** n questions for the subject, spread across distinct concept branches, easy→hard. */
  function sampleQuiz(subject: Subject, n = 5): Question[] {
    const pool = questions.filter((q) => q.subject === subject);
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

  function toPublic(q: Question): PublicQuestion {
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
  function scoreGaps(graded: GradedResponse[]): GapCandidate[] {
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
        e.score += weight(g) + (g.concepts.includes(c) ? 0.1 : 0);
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

  return { concepts, getConcept, getQuestion, ancestors, scoreGaps, sampleQuiz, toPublic };
}

const staticGraph = makeGraph(graph.concepts, bank.questions);

export function getGraph(): ConceptGraph { return graph; }
export const getConcept = staticGraph.getConcept;
export function conceptsForSubject(subject: Subject): Concept[] { return graph.concepts.filter((c) => c.subject === subject); }
/** All transitive prerequisites of a concept (excluding itself), nearest first. */
export const ancestors = staticGraph.ancestors;
export const getQuestion = staticGraph.getQuestion;
export const sampleQuiz = staticGraph.sampleQuiz;
export const toPublic = staticGraph.toPublic;
export const scoreGaps = staticGraph.scoreGaps;

const packCache = new Map<string, Graph>();
/** Graph for a TopicPack (memoized by pack.id, small LRU) or the static bank when no pack. */
export function graphFor(pack?: TopicPack): Graph {
  if (!pack) return staticGraph;
  const hit = packCache.get(pack.id);
  if (hit) { packCache.delete(pack.id); packCache.set(pack.id, hit); return hit; }
  const g = makeGraph(pack.concepts, pack.questions);
  packCache.set(pack.id, g);
  if (packCache.size > 50) packCache.delete(packCache.keys().next().value!);
  return g;
}

const PRESET_TOPIC: Record<string, string> = { math: "Fractions", physics: "Motion and forces", chemistry: "Atoms and reactions" };

/** Build a pack from the static bank for a preset subject. */
export function presetPack(subject: Subject): TopicPack {
  const concepts = conceptsForSubject(subject);
  const grades = concepts.map((c) => c.grade);
  const lo = grades.length ? Math.min(...grades) : 6;
  const hi = grades.length ? Math.max(...grades) : 8;
  const qs = staticGraph.sampleQuiz(subject, 5);
  const cs0 = concepts.slice(0, 14);
  const keep = new Set(cs0.map((c) => c.id));
  const cs = cs0.map((c) => ({ ...c, prerequisites: c.prerequisites.filter((p) => keep.has(p)) }));
  return {
    id: `preset-${subject}-${Math.random().toString(36).slice(2, 8)}`,
    topic: PRESET_TOPIC[subject] ?? subject,
    subject,
    level: lo === hi ? `Grade ${lo}` : `Grade ${lo}\u2013${hi}`,
    source: "preset",
    concepts: cs,
    questions: qs,
  };
}
