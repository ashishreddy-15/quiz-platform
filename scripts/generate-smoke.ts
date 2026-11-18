// Usage: BASE_URL=http://localhost:3101 npx tsx scripts/generate-smoke.ts
import { TopicPackSchema, type TopicPack } from "../lib/schema";

const BASE = process.env.BASE_URL ?? "http://localhost:3101";
const TOPICS = ["Photosynthesis", "Supply and demand"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (ok: boolean, msg: string) => { if (!ok) { failed = true; console.log(`  FAIL: ${msg}`); } };

async function post(path: string, body: unknown) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

async function run(topic: string) {
  console.log(`\n=== ${topic} ===`);
  const t0 = Date.now();
  const g = await post("/api/generate", { topic });
  console.log(`generate: ${g.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  check(g.status === 200, `generate status ${g.status} ${JSON.stringify(g.j)}`);
  if (g.status !== 200) return;
  const parsed = TopicPackSchema.safeParse(g.j.pack);
  check(parsed.success, "pack fails TopicPackSchema");
  if (!parsed.success) return;
  const pack: TopicPack = parsed.data;
  console.log(`level=${pack.level} source=${pack.source}`);
  console.log("concepts:", pack.concepts.map((c) => `${c.name} (g${c.grade}, <-${c.prerequisites.length})`).join(" | "));
  pack.questions.forEach((q) => console.log(`  ${q.id} [d${q.difficulty}] ${q.stem}  -> ${q.concepts.join(",")}`));
  check(pack.questions.length === 5, "expected 5 questions");
  const ids = new Set(pack.concepts.map((c) => c.id));
  check(pack.concepts.every((c) => c.prerequisites.every((p) => ids.has(p))), "dangling prerequisite");
  check(pack.questions.every((q) => q.concepts.every((c) => ids.has(c))), "question refs unknown concept");
  check(pack.questions.every((q) => q.options?.length === 4 && q.options.filter((o) => o.misconception === null).length === 1), "bad options");

  const responses = pack.questions.map((q) => ({ qid: q.id, answer: q.options!.find((o) => o.misconception !== null)!.id, confidence: 0.9, timeMs: 8000 }));
  const gr = await post("/api/grade", { responses, pack });
  check(gr.status === 200 && gr.j.graded?.every((x: { correct: boolean }) => !x.correct), `grade: ${gr.status}`);
  const d = await post("/api/diagnose", { subject: pack.subject, graded: gr.j.graded, pack });
  check(d.status === 200, `diagnose status ${d.status}`);
  const top = d.j.root_gaps?.[0]?.concept_id;
  console.log(`diagnose: root_gap[0]=${top}${d.j.fallback ? " (heuristic fallback)" : ""}`);
  check(!!top && ids.has(top), "root_gaps[0] not in pack concepts");
}

(async () => {
  for (let i = 0; i < TOPICS.length; i++) {
    if (i) { console.log("\n(pausing 35s for rate limit)"); await sleep(35000); }
    try { await run(TOPICS[i]); } catch (e) { failed = true; console.log("  FAIL: exception", e); }
  }
  console.log(failed ? "\nFAIL" : "\nPASS");
  process.exit(failed ? 1 : 0);
})();
