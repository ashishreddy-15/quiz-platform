import { NextResponse } from "next/server";
import { z } from "zod";
import { getConcept } from "@/lib/graph";
import { chatStream } from "@/lib/llm";
import { lessonPrompt } from "@/lib/prompts";
import { getFallbackLesson } from "@/lib/fallback";
import { parseBody, safeErr } from "@/lib/route-util";
import type { LessonReq } from "@/lib/api-contract";

export const runtime = "nodejs";

const Req = z.object({
  conceptId: z.string(),
  misconception: z.string().max(1000),
  wrongAnswer: z.string().max(1000),
  stem: z.string().max(2000),
  interest: z.string().max(60),
  attempt: z.number().int().min(1).max(10),
  previousAnalogy: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const p = await parseBody(req, Req);
  if (!p.ok) return p.res;
  const body: LessonReq = p.data;
  const concept = getConcept(body.conceptId);
  if (!concept) return NextResponse.json({ error: "Unknown concept" }, { status: 400 });
  const h = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
  try {
    const { system, user } = lessonPrompt(concept, body);
    const stream = await chatStream({ system, user, temperature: 0.7 });
    return new Response(stream, { headers: h });
  } catch (e) {
    console.error("lesson failed:", safeErr(e));
    return new Response(getFallbackLesson(body.conceptId, body.interest), { headers: { ...h, "x-fallback": "1" } });
  }
}
