import concepts from "../data/concepts.json";
import bank from "../data/question-bank.json";
import { ConceptGraphSchema, QuestionBankSchema } from "../lib/schema";

const errors: string[] = [];
const g = ConceptGraphSchema.parse(concepts);
const b = QuestionBankSchema.parse(bank);
const ids = new Set(g.concepts.map((c) => c.id));
if (ids.size !== g.concepts.length) errors.push("duplicate concept ids");
for (const c of g.concepts) for (const p of c.prerequisites) if (!ids.has(p)) errors.push(`${c.id}: unknown prerequisite ${p}`);

// cycle detection + depth
const byId = new Map(g.concepts.map((c) => [c.id, c]));
const state = new Map<string, number>();
const depth = new Map<string, number>();
function visit(id: string, path: string[]): number {
  if (state.get(id) === 2) return depth.get(id)!;
  if (state.get(id) === 1) { errors.push(`cycle: ${[...path, id].join(" -> ")}`); return 0; }
  state.set(id, 1);
  let d = 1;
  for (const p of byId.get(id)?.prerequisites ?? []) d = Math.max(d, 1 + visit(p, [...path, id]));
  state.set(id, 2); depth.set(id, d);
  return d;
}
for (const c of g.concepts) visit(c.id, []);

const qids = new Set<string>();
const tags = new Map<string, Set<string>>();
const tag = (t: string, q: string) => { if (!tags.has(t)) tags.set(t, new Set()); tags.get(t)!.add(q); };
for (const q of b.questions) {
  if (qids.has(q.id)) errors.push(`duplicate question id ${q.id}`);
  qids.add(q.id);
  for (const c of q.concepts) {
    if (!ids.has(c)) errors.push(`${q.id}: unknown concept ${c}`);
    else if (byId.get(c)!.subject !== q.subject) errors.push(`${q.id}: concept ${c} in different subject`);
  }
  if (q.type === "mcq") {
    const o = q.options ?? [];
    if (o.length !== 4) errors.push(`${q.id}: needs exactly 4 options`);
    const nulls = o.filter((x) => x.misconception === null);
    if (nulls.length !== 1) errors.push(`${q.id}: needs exactly one null-misconception option`);
    else if (nulls[0].id !== q.answer) errors.push(`${q.id}: answer ${q.answer} != correct option ${nulls[0].id}`);
    for (const x of o) if (x.misconception !== null) { if (!/^[a-z0-9_]+$/.test(x.misconception)) errors.push(`${q.id}: bad tag ${x.misconception}`); tag(x.misconception, q.id); }
  } else {
    if (!q.accepted_patterns?.length) errors.push(`${q.id}: short needs accepted_patterns`);
    for (const p of [...(q.accepted_patterns ?? []), ...(q.common_wrong ?? []).map((w) => w.pattern)]) {
      try { new RegExp(p, "i"); } catch { errors.push(`${q.id}: bad regex ${p}`); }
    }
    for (const w of q.common_wrong ?? []) tag(w.misconception, q.id);
  }
}

for (const s of g.subjects) {
  const cs = g.concepts.filter((c) => c.subject === s);
  const qs = b.questions.filter((q) => q.subject === s);
  const maxD = Math.max(...cs.map((c) => depth.get(c.id) ?? 0));
  console.log(`${s}: ${cs.length} concepts (max depth ${maxD}), ${qs.length} questions (${qs.filter((q) => q.type === "short").length} short)`);
  if (maxD < 3) errors.push(`${s}: depth < 3`);
}
const reused = [...tags].filter(([, v]) => v.size > 1);
console.log(`misconception tags: ${tags.size}, reused across questions: ${reused.length}`);
for (const [t, v] of reused) console.log(`  ${t}: ${[...v].join(", ")}`);
if (errors.length) { console.error("FAIL\n" + errors.join("\n")); process.exit(1); }
console.log("OK");
