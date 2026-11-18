import { NextResponse } from "next/server";
import { z } from "zod";
import { sampleQuiz, toPublic } from "@/lib/graph";
import { SubjectSchema } from "@/lib/schema";
import { parseBody } from "@/lib/route-util";
import type { QuizRes } from "@/lib/api-contract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ subject: SubjectSchema }));
  if (!p.ok) return p.res;
  const body: QuizRes = { questions: sampleQuiz(p.data.subject).map(toPublic) };
  return NextResponse.json(body);
}
