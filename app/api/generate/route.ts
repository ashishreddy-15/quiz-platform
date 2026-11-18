import { NextResponse } from "next/server";
import { z } from "zod";
import { presetPack } from "@/lib/graph";
import { chatJSON } from "@/lib/llm";
import { buildPack, matchPreset } from "@/lib/pack";
import { GenerationSchema, generatePrompt } from "@/lib/prompts";
import { parseBody, safeErr } from "@/lib/route-util";
import type { GenerateRes } from "@/lib/api-contract";

export const runtime = "nodejs";
export const maxDuration = 60;

const Req = z.object({
  topic: z.string().transform((s) => s.replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim()).pipe(z.string().min(2).max(120)),
  level: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const p = await parseBody(req, Req);
  if (!p.ok) return p.res;
  const { topic } = p.data;
  const level = p.data.level?.replace(/[<>\u0000-\u001f]/g, " ").trim() || "High school";
  if (!/[\p{L}\p{N}]{2,}/u.test(topic)) return NextResponse.json({ error: "Please enter a topic to learn about." }, { status: 400 });

  const t0 = Date.now();
  let problems: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { system, user } = generatePrompt(topic, level, problems);
      const gen = await chatJSON({ reasoning: "low", system, user, toolName: "create_topic_pack", toolDescription: "Create the concept graph and 5 diagnostic questions", schema: GenerationSchema, temperature: 0.5 });
      const r = buildPack(gen, topic, level);
      if (r.pack) {
        console.info(`[generate] "${topic}" ok in ${Date.now() - t0}ms (attempt ${attempt + 1})`);
        const out: GenerateRes = { pack: r.pack };
        return NextResponse.json(out);
      }
      problems = r.problems;
      console.warn("[generate] invalid pack:", problems.join(" | "));
    } catch (e) {
      console.error("[generate] failed:", safeErr(e));
      problems = ["the output did not match the required schema; return exactly 5 questions with 4 options each"];
    }
  }
  const preset = matchPreset(topic);
  console.info(`[generate] "${topic}" fell back (${preset ?? "none"}) after ${Date.now() - t0}ms`);
  if (preset) return NextResponse.json({ pack: presetPack(preset) } satisfies GenerateRes);
  return NextResponse.json({ error: "Couldn't build a quiz for that topic — try rephrasing or pick a suggestion." }, { status: 502 });
}
