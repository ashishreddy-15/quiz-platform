import { NextResponse } from "next/server";
import { z } from "zod";
import { graphFor } from "@/lib/graph";
import { gradeLocal } from "@/lib/grading";
import { chatJSON } from "@/lib/llm";
import { shortGradePrompt } from "@/lib/prompts";
import { ResponseSchema, TopicPackSchema, ShortGradeSchema, type GradedResponse } from "@/lib/schema";
import { parseBody } from "@/lib/route-util";
import type { GradeRes } from "@/lib/api-contract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ responses: z.array(ResponseSchema).min(1).max(20), pack: TopicPackSchema.optional() }));
  if (!p.ok) return p.res;
  const { getQuestion } = graphFor(p.data.pack);
  const unknown = p.data.responses.find((r) => !getQuestion(r.qid));
  if (unknown) return NextResponse.json({ error: `Unknown question ${unknown.qid}` }, { status: 400 });

  const graded: GradedResponse[] = await Promise.all(
    p.data.responses.map(async (r) => {
      const q = getQuestion(r.qid)!;
      const { graded: g, ambiguous } = gradeLocal(q, r);
      if (!ambiguous) return g;
      try {
        const { system, user } = shortGradePrompt(q, r.answer);
        const j = await chatJSON({ reasoning: "low", system, user, toolName: "grade_short_answer", toolDescription: "Grade a short answer", schema: ShortGradeSchema, temperature: 0.1 });
        return { ...g, correct: j.correct, feedback: j.feedback };
      } catch (e) {
        console.error("short grade failed", e instanceof Error ? e.message : e);
        return { ...g, correct: false };
      }
    }),
  );
  const body: GradeRes = { graded };
  return NextResponse.json(body);
}
