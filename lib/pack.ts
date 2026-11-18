// Turns raw LLM generation output into a validated TopicPack. Pure (no server-only imports).
import { slugify, type Generation } from "./prompts";
import { TopicPackSchema, type Concept, type Question, type TopicPack } from "./schema";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function buildPack(gen: Generation, topic: string, level: string): { pack?: TopicPack; problems: string[] } {
  const problems: string[] = [];
  const subject = slugify(topic);

  // concepts: unique ids, drop unknown prereqs and self refs
  const seen = new Set<string>();
  const raw = gen.concepts.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).slice(0, 12);
  const ids = new Set(raw.map((c) => c.id));
  const prereqs = new Map<string, string[]>(raw.map((c) => [c.id, [...new Set(c.prerequisites.filter((p) => ids.has(p) && p !== c.id))]]));

  // break cycles: DFS, remove back-edges
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    const kept: string[] = [];
    for (const p of prereqs.get(id) ?? []) {
      if (state.get(p) === 1) continue; // back-edge
      if (!state.has(p)) visit(p);
      kept.push(p);
    }
    prereqs.set(id, kept);
    state.set(id, 2);
  };
  for (const c of raw) if (!state.has(c.id)) visit(c.id);

  const concepts: Concept[] = raw.map((c) => ({
    id: c.id, subject, name: clip(c.name.trim(), 40), description: c.description.trim(),
    prerequisites: prereqs.get(c.id) ?? [], grade: Math.max(1, Math.min(16, c.grade)),
  }));
  if (concepts.length < 4) problems.push(`only ${concepts.length} unique concepts; need 6-10`);
  if (!concepts.some((c) => c.prerequisites.length === 0)) problems.push("no foundation concept with prerequisites: []");

  const letters = ["a", "b", "c", "d"];
  const questions: Question[] = [];
  gen.questions.forEach((q, i) => {
    const cs = [...new Set(q.concepts.filter((c) => ids.has(c)))];
    if (!cs.length) return void problems.push(`question ${i + 1} references no known concept ids`);
    if (new Set(q.options.map((o) => o.id)).size !== 4) return void problems.push(`question ${i + 1} option ids must be unique a-d`);
    // Auto-repair the answer key instead of regenerating: `answer` wins if it names an option,
    // otherwise a single null-misconception option is taken as the answer.
    const nulls = q.options.filter((o) => o.misconception === null);
    const answerId = q.options.some((o) => o.id === q.answer) ? q.answer : nulls.length === 1 ? nulls[0].id : null;
    if (!answerId) return void problems.push(`question ${i + 1} must have exactly one option with misconception null and its id equal to answer`);
    const fixedOpts = q.options.map((o) => ({
      ...o,
      misconception: o.id === answerId ? null : (o.misconception ?? "unspecified_misconception"),
    }));
    const options = shuffle(fixedOpts).map((o, k) => ({ id: letters[k], text: clip(o.text.trim(), 120), misconception: o.misconception ? slugify(o.misconception) : null }));
    questions.push({
      id: "", subject, type: "mcq", difficulty: q.difficulty, stem: q.stem.trim(), concepts: cs, options,
      answer: options.find((o) => o.misconception === null)!.id, explanation: q.explanation.trim(),
    });
  });
  const final = questions.slice(0, 5).map((q, i) => ({ ...q, id: `q${i + 1}` }));
  // 4 good questions beat a 10-20 s regeneration; only retry below that.
  if (final.length < 4) problems.push(`only ${final.length} valid questions; need exactly 5`);
  if (problems.length) return { problems };

  const parsed = TopicPackSchema.safeParse({
    id: `${subject}-${Math.random().toString(36).slice(2, 8)}`,
    topic: topic.trim(), subject, level, source: "ai", concepts, questions: final,
  });
  if (!parsed.success) return { problems: [parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")] };
  return { pack: parsed.data, problems: [] };
}

/** Loose topic -> preset matching for the last-resort fallback. */
export function matchPreset(topic: string): "math" | "physics" | "chemistry" | null {
  const t = topic.toLowerCase();
  if (/fraction|\bmath\b|arithmetic/.test(t)) return "math";
  if (/motion|force|kinematic|physic|velocity|newton/.test(t)) return "physics";
  if (/atom|chem|reaction|mole|element/.test(t)) return "chemistry";
  return null;
}
