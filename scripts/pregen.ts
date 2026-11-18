// Usage: npx tsx --env-file=.env.local scripts/pregen.ts
import fs from "node:fs";
import path from "node:path";
import Groq from "groq-sdk";
import { z } from "zod";
import { getGraph } from "../lib/graph";
import { lessonPrompt, masteryPrompt } from "../lib/prompts";
import { MasteryItemsSchema } from "../lib/schema";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const root = path.join(process.cwd(), "data/fallback");
fs.mkdirSync(path.join(root, "lessons"), { recursive: true });
fs.mkdirSync(path.join(root, "mastery"), { recursive: true });

async function lesson(system: string, user: string) {
  const r = await groq.chat.completions.create({ model: MODEL, temperature: 0.6, messages: [{ role: "system", content: system }, { role: "user", content: user }], ...({ reasoning_effort: "low" } as object) });
  return r.choices[0]?.message?.content ?? "";
}

async function mastery(system: string, user: string) {
  const parameters = z.toJSONSchema(MasteryItemsSchema, { target: "draft-7" }) as Record<string, unknown>;
  delete parameters.$schema;
  for (let i = 0; i < 3; i++) {
    const r = await groq.chat.completions.create({
      model: MODEL, temperature: 0.5,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{ type: "function", function: { name: "create_mastery_items", description: "Create 3 mastery items", parameters } }],
      tool_choice: { type: "function", function: { name: "create_mastery_items" } },
      ...({ reasoning_effort: "medium" } as object),
    });
    try {
      const j = MasteryItemsSchema.parse(JSON.parse(r.choices[0]?.message?.tool_calls?.[0]?.function?.arguments ?? ""));
      const ok = j.items.every((it) => it.options.filter((o) => o.misconception === null).length === 1 && it.options.find((o) => o.misconception === null)?.id === it.answer);
      if (ok) return j;
    } catch {}
  }
  throw new Error("mastery generation failed");
}

async function main() {
  const concepts = getGraph().concepts;
  const queue = [...concepts];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const lf = path.join(root, "lessons", `${c.id}.md`);
      const mf = path.join(root, "mastery", `${c.id}.json`);
      try {
        if (!fs.existsSync(lf)) {
          const { system, user } = lessonPrompt(c, { conceptId: c.id, misconception: `a common confusion about ${c.name}`, wrongAnswer: "(not provided; address the most common error)", stem: `A question about ${c.name}`, interest: "sports", attempt: 1 });
          fs.writeFileSync(lf, await lesson(system, user));
        }
        if (!fs.existsSync(mf)) {
          const { system, user } = masteryPrompt(c, { conceptId: c.id, misconception: `a common confusion about ${c.name}`, attempt: 1 });
          fs.writeFileSync(mf, JSON.stringify(await mastery(system, user), null, 2));
        }
        console.log("done", c.id);
      } catch (e) {
        console.error("failed", c.id, String(e).slice(0, 200));
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
main();
