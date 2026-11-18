import { NextResponse } from "next/server";
import { z } from "zod";
import { graphFor } from "@/lib/graph";
import { chatJSON } from "@/lib/llm";
import { teachbackPrompt } from "@/lib/prompts";
import { TeachbackResultSchema, TopicPackSchema } from "@/lib/schema";
import { parseBody, safeErr } from "@/lib/route-util";
import type { TeachbackRes } from "@/lib/api-contract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ conceptId: z.string(), explanation: z.string().min(1).max(3000), misconception: z.string().max(1000), pack: TopicPackSchema.optional() }));
  if (!p.ok) return p.res;
  const concept = graphFor(p.data.pack).getConcept(p.data.conceptId);
  if (!concept) return NextResponse.json({ error: "Unknown concept" }, { status: 400 });
  try {
    const { system, user } = teachbackPrompt(concept, p.data);
    const r: TeachbackRes = await chatJSON({ reasoning: "low", system, user, toolName: "grade_teachback", toolDescription: "Grade the student's explanation", schema: TeachbackResultSchema, temperature: 0.2 });
    return NextResponse.json(r);
  } catch (e) {
    console.error("teachback failed:", safeErr(e));
    return NextResponse.json({ error: "Grading unavailable" }, { status: 502 });
  }
}
