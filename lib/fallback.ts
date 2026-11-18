import fs from "node:fs";
import path from "node:path";
import { getConcept, getQuestion } from "./graph";
import { LESSON_HEADINGS } from "./api-contract";
import type { MasteryItem, Question } from "./schema";

const dir = (...p: string[]) => path.join(process.cwd(), "data/fallback", ...p);

export function getFallbackLesson(conceptId: string, interest: string): string {
  try {
    const f = dir("lessons", `${conceptId}.md`);
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  } catch {}
  const c = getConcept(conceptId);
  const name = c?.name ?? conceptId;
  const desc = c?.description ?? "";
  const [h1, h2, h3, h4, h5] = LESSON_HEADINGS;
  return `## ${h1}\n**${name}**: ${desc}\n\n## ${h2}\nIt is very common to mix this idea up with a nearby one. Your answer made sense given a quick pattern, but it skipped a step. Slow down and check each step against the definition above.\n\n## ${h3}\nThink about ${interest}: every rule in it has parts that depend on each other. Match each part of a ${interest} situation to a part of "${name}", then check the rule holds at every step.\n\n## ${h4}\nPick a small example of ${name.toLowerCase()}. Write down what is given, apply the definition one step at a time, and check the result against the idea above.\n\n## ${h5}\nIn your own words, explain ${name.toLowerCase()} in one sentence.\n\n<details><summary>Answer</summary>\n${desc}\n</details>\n`;
}

function readBank(): Question[] {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/question-bank.json"), "utf8"));
    return j.questions ?? [];
  } catch {
    return [];
  }
}

export function getFallbackMastery(conceptId: string): MasteryItem[] {
  try {
    const f = dir("mastery", `${conceptId}.json`);
    if (fs.existsSync(f)) {
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      const items = Array.isArray(j) ? j : j.items;
      if (Array.isArray(items) && items.length === 3) return items;
    }
  } catch {}
  const bank = readBank().filter((q) => q.type === "mcq" && q.options?.length === 4);
  // questions testing the concept itself first, then ones that merely touch descendants (via bank concepts' prerequisites)
  const direct = bank.filter((q) => q.concepts.includes(conceptId));
  const related = bank.filter((q) => !direct.includes(q) && q.concepts.some((cid) => anc(cid).includes(conceptId)));
  const pool = [...direct.sort((a, b) => a.difficulty - b.difficulty), ...related.sort((a, b) => a.difficulty - b.difficulty)];
  const full = pool.length ? pool : bank;
  const kinds = ["recall", "application", "transfer"] as const;
  return kinds.map((kind, i) => {
    const q = getQuestion(full[Math.min(i, full.length - 1)]?.id ?? "") ?? full[Math.min(i, full.length - 1)];
    return { kind, stem: q.stem, options: q.options!, answer: q.answer, explanation: q.explanation };
  });
}

function anc(id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const c = getConcept(stack.pop()!);
    for (const p of c?.prerequisites ?? []) if (!seen.has(p)) { seen.add(p); out.push(p); stack.push(p); }
  }
  return out;
}
